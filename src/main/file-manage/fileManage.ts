import { ossDownloadAvatar, ossDownloadFile, ossUploadAvatar, ossUploadFile } from './aliyunOssApi'
import { BrowserWindow, dialog, ipcMain, OpenDialogOptions, shell } from 'electron'
import path from 'path'
import fs from 'fs/promises'
import sharp from 'sharp'
import { ApiResult, MimeContentTypeMap, UniversalFile } from '@shared/types'
import { getMIMEFromFilename, MIME } from '@shared/utils'
import { createHash } from 'crypto'
import { localFileManager } from './localFileApi'

// 头像压缩配置
const AVATAR_COMPRESS_CONFIG = {
  width: 128, // 目标宽度
  height: 128, // 目标高度
  quality: 80 // 压缩质量 (0-100)
}

/**
 * ArrayBuffer 转 Buffer（仅用于 sharp 等依赖 Buffer 的底层库）
 * @param arrayBuffer 待转换的 ArrayBuffer
 * @returns 转换后的 Buffer
 */
const arrayBufferToBuffer = (arrayBuffer: ArrayBuffer): Buffer => {
  return Buffer.from(arrayBuffer)
}

/**
 * 压缩图片为指定尺寸（输入输出均为 ArrayBuffer 类型）
 * @param file 原始图片文件（符合 UniversalFile 规范）
 * @returns 压缩后的图片文件（content 为 ArrayBuffer）
 */
const compressImage = async (file: UniversalFile): Promise<UniversalFile> => {
  if (!file.content) {
    throw new Error('图片内容不能为空')
  }
  if (!file.mimeType?.startsWith('image/')) {
    throw new Error(`不支持的图片类型: ${file.mimeType}`)
  }
  if (!['Base64', 'ArrayBuffer'].includes(file.contentType || '')) {
    throw new Error(`图片压缩仅支持 Base64/ArrayBuffer 格式，当前为: ${file.contentType}`)
  }

  // 统一将输入内容转换为 Buffer（适配 sharp 库）
  let imageBuffer: Buffer
  if (file.contentType === 'Base64' && typeof file.content === 'string') {
    // 移除 dataURL 前缀（若存在）并解码 Base64
    const base64Data = file.content.replace(/^data:[^;]+;base64,/, '')
    imageBuffer = Buffer.from(base64Data, 'base64')
  } else if (file.contentType === 'ArrayBuffer' && file.content instanceof ArrayBuffer) {
    // ArrayBuffer 转 Buffer（仅临时用于 sharp 处理）
    imageBuffer = arrayBufferToBuffer(file.content)
  } else {
    throw new Error(`图片内容与格式不匹配，contentType: ${file.contentType}`)
  }

  // 执行图片压缩
  const compressedBuffer = await sharp(imageBuffer)
    .resize(AVATAR_COMPRESS_CONFIG.width, AVATAR_COMPRESS_CONFIG.height, {
      fit: 'cover', // 保持比例并填充目标尺寸
      withoutEnlargement: true, // 不放大小于目标尺寸的图片
      background: { r: 255, g: 255, b: 255, alpha: 0 } // 透明背景（PNG 适用）
    })
    .jpeg({ quality: AVATAR_COMPRESS_CONFIG.quality, mozjpeg: true }) // 强制转为 JPEG 格式
    .toBuffer()

  // 转换压缩结果为 ArrayBuffer，保持输出类型一致性
  const compressedArrayBuffer = compressedBuffer.buffer.slice(
    compressedBuffer.byteOffset,
    compressedBuffer.byteOffset + compressedBuffer.byteLength
  )

  // 返回压缩后的文件对象（严格遵循 UniversalFile 接口）
  return {
    ...file,
    fileName: `${path.basename(file.fileName, path.extname(file.fileName))}.jpg`, // 统一后缀为 .jpg
    mimeType: 'image/jpeg', // 压缩后统一为 JPEG 类型
    content: compressedArrayBuffer as ArrayBuffer,
    contentType: 'ArrayBuffer', // 明确标记为 ArrayBuffer
    fileSize: compressedArrayBuffer.byteLength // 使用 ArrayBuffer 实际长度
  }
}

/**
 * 获取用户文件（优先本地读取，本地不存在则从 OSS 下载并缓存到本地）
 * @param fileName 文件名（含扩展名）
 * @param contentType 期望返回的内容格式（null/ArrayBuffer/Base64/Text）
 * @returns 包含文件信息的 ApiResult
 */
export const getUserFile = async (
  fileName: string,
  contentType: null | 'ArrayBuffer' | 'Base64' | 'Text'
): Promise<ApiResult<UniversalFile>> => {
  try {
    // 1. 检查本地文件是否存在
    const localExists = await localFileManager.userFileExists(fileName)

    if (localExists) {
      // 2. 本地存在，直接读取（依赖 localFileApi 的 ArrayBuffer 实现）
      const localFile = await localFileManager.readUserFile(fileName, contentType)
      return {
        isSuccess: true,
        data: localFile
      }
    }

    // 3. 本地不存在，从 OSS 下载（依赖 aliyunOssApi 的 ArrayBuffer 实现）
    const ossResult = await ossDownloadFile(fileName, localFileManager.getUserFileDir())
    if (!ossResult.isSuccess || !ossResult.data) {
      return {
        isSuccess: false,
        msg: ossResult.msg || '从 OSS 下载文件失败'
      }
    }

    // 4. 下载成功后缓存到本地（依赖 localFileApi 的 ArrayBuffer 实现）
    const cachedFile = await localFileManager.readUserFile(fileName, contentType)
    return {
      isSuccess: true,
      data: cachedFile
    }
  } catch (error) {
    return {
      isSuccess: false,
      msg: `获取文件失败: ${error instanceof Error ? error.message : String(error)}`
    }
  }
}

/**
 * 上传用户文件（同时上传到 OSS 和本地保存，双端同步）
 * @param file 待上传的文件（符合 UniversalFile 规范，content 为 null/ArrayBuffer/Base64/Text）
 * @returns 包含上传结果的 ApiResult
 */
export const uploadUserFile = async (file: UniversalFile): Promise<ApiResult<UniversalFile>> => {
  try {
    // 1. 校验入参（确保符合 UniversalFile 接口要求）
    if (!file.fileName) throw new Error('文件名不能为空')
    if (file.content === undefined && file.contentType !== null) {
      throw new Error('文件内容不能为空（contentType 非 null 时）')
    }

    // 2. 先上传到 OSS
    const ossResult = await ossUploadFile(file)
    if (!ossResult.isSuccess || !ossResult.data) {
      return {
        isSuccess: false,
        msg: ossResult.msg || '上传文件到 OSS 失败'
      }
    }

    // 3. OSS 上传成功后，同步保存到本地
    const localResult = await localFileManager.writeUserFile(ossResult.data)
    return {
      isSuccess: true,
      data: localResult
    }
  } catch (error) {
    return {
      isSuccess: false,
      msg: `上传文件失败: ${error instanceof Error ? error.message : String(error)}`
    }
  }
}

/**
 * 获取头像文件（优先本地读取，本地不存在则从 OSS 下载并缓存）
 * @param fileName 头像文件名（含扩展名）
 * @param contentType 期望返回的内容格式（null/ArrayBuffer/Base64，默认 Base64）
 * @returns 包含头像信息的 ApiResult
 */
export const getAvatar = async (
  fileName: string,
  contentType: null | 'ArrayBuffer' | 'Base64' = 'Base64'
): Promise<ApiResult<UniversalFile>> => {
  try {
    // 检查本地头像是否存在
    const localExists = await localFileManager.avatarExists(fileName)

    if (localExists) {
      // 本地存在，直接读取（依赖 localFileApi 的 ArrayBuffer 实现）
      const localAvatar = await localFileManager.readAvatar(fileName, contentType)
      return {
        isSuccess: true,
        data: localAvatar
      }
    }

    // 本地不存在，从 OSS 下载（依赖 aliyunOssApi 的 ArrayBuffer 实现）
    const ossResult = await ossDownloadAvatar(localFileManager.getAvatarDir())
    if (!ossResult.isSuccess || !ossResult.data) {
      return {
        isSuccess: false,
        msg: ossResult.msg || '从 OSS 下载头像失败'
      }
    }

    const cachedAvatar = await localFileManager.readAvatar(fileName, contentType)
    return {
      isSuccess: true,
      data: cachedAvatar
    }
  } catch (error) {
    return {
      isSuccess: false,
      msg: `获取头像失败: ${error instanceof Error ? error.message : String(error)}`
    }
  }
}

/**
 * 上传头像文件（先压缩，再同步上传到 OSS 和本地）
 * @param file 待上传的原始头像文件（符合 UniversalFile 规范）
 * @returns 包含上传结果的 ApiResult
 */
export const uploadAvatar = async (file: UniversalFile): Promise<ApiResult<UniversalFile>> => {
  try {
    // 1. 压缩图片（输入输出均为 ArrayBuffer 类型）
    const compressedAvatar = await compressImage(file)
    console.log(`头像压缩完成: ${compressedAvatar.fileName} (${compressedAvatar.fileSize} 字节)`)

    // 2. 上传压缩后的头像到 OSS
    const ossResult = await ossUploadAvatar(compressedAvatar)
    if (!ossResult.isSuccess || !ossResult.data) {
      return {
        isSuccess: false,
        msg: ossResult.msg || '上传头像到 OSS 失败'
      }
    }

    // 3. 第三步：同步保存到本地（依赖 localFileApi 的 ArrayBuffer 实现）
    const localResult = await localFileManager.writeAvatar(ossResult.data)
    return {
      isSuccess: true,
      data: localResult
    }
  } catch (error) {
    return {
      isSuccess: false,
      msg: `上传头像失败: ${error instanceof Error ? error.message : String(error)}`
    }
  }
}

/**
 * 计算文件指纹（使用SHA-256算法）
 * @param filePath 文件路径
 * @returns 文件指纹字符串
 */
async function calculateFileFingerprint(filePath: string): Promise<string> {
  try {
    // 创建哈希实例
    const hash = createHash('sha256')

    // 打开文件流，避免一次性加载大文件到内存
    const fileHandle = await fs.open(filePath, 'r')
    const stream = fileHandle.createReadStream({ highWaterMark: 64 * 1024 }) // 64KB块

    // 流式处理文件内容
    for await (const chunk of stream) {
      hash.update(chunk)
    }

    await fileHandle.close()

    // 返回十六进制格式的哈希值
    return hash.digest('hex')
  } catch (error) {
    console.error(`计算文件 ${filePath} 指纹失败:`, error)
    // 出错时返回空字符串或特殊标识
    return ''
  }
}

export const getContentTypeFromMimeMap = (
  specificMime: string,
  mimeMap: MimeContentTypeMap
): null | 'Base64' | 'Text' | 'ArrayBuffer' => {
  // 直接用具体MIME作为key查询映射表
  if (Object.prototype.hasOwnProperty.call(mimeMap, specificMime)) {
    return mimeMap[specificMime] as null | 'Base64' | 'Text' | 'ArrayBuffer'
  }
  // 拆分MIME类型（格式：类型/子类型，如 "image/png" 拆分为 ["image", "png"]）
  const mimeParts = specificMime.split('/')
  // 仅当MIME格式合法（包含 "/" 且前缀非空）时，才尝试通配符匹配
  if (mimeParts.length === 2 && mimeParts[0].trim()) {
    const mimePrefix = mimeParts[0] // 提取前缀（如 "image"、"text"）
    const wildcardKey = `${mimePrefix}/*` as keyof MimeContentTypeMap // 构造通配符key（如 "image/*"）
    // 检查映射表是否存在该通配符key
    if (Object.prototype.hasOwnProperty.call(mimeMap, wildcardKey)) {
      return mimeMap[wildcardKey] as null | 'Base64' | 'Text' | 'ArrayBuffer'
    }
  }
  // 无匹配时返回默认值（根据业务需求可调整为其他值）
  return null
}

/**
 * 打开文件选择器（Electron 原生对话框）
 * @returns 包含选中文件列表的 ApiResult
 */
export const openFileDialog = async (
  contentTypeMap: MimeContentTypeMap
): Promise<ApiResult<UniversalFile[]>> => {
  try {
    // 1. 获取当前聚焦窗口（作为对话框父窗口）
    const parentWindow = BrowserWindow.getFocusedWindow()
    if (!parentWindow) {
      return {
        isSuccess: false,
        msg: '主窗口未打开，无法选择文件'
      }
    }

    // 2. 配置文件选择对话框
    const dialogOptions: OpenDialogOptions = {
      title: '选择文件',
      properties: ['openFile', 'multiSelections'] as const, // 支持多选
      filters: [{ name: '所有文件', extensions: ['*'] }] // 允许所有文件类型
    }

    // 3. 打开对话框并获取用户选择结果
    const { canceled, filePaths } = await dialog.showOpenDialog(parentWindow, dialogOptions)
    if (canceled || filePaths.length === 0) {
      return { isSuccess: true, data: [] } // 用户取消选择，返回空列表
    }

    // 4. 处理每个选中的文件，转换为 UniversalFile 格式
    const universalFiles: UniversalFile[] = []
    const CRITICAL = 100 * 1024 * 1024 // 100MB的字节数

    for (const filePath of filePaths) {
      try {
        // 4.1 获取文件基本信息（大小、名称等）
        const fileStats = await fs.stat(filePath)
        const fileName = path.basename(filePath)
        const mimeType: MIME = getMIMEFromFilename(fileName) || 'application/octet-stream'
        const isLargeFile = fileStats.size > CRITICAL // 判断是否大于1GB

        // 4.2 计算文件指纹
        const fingerprint = await calculateFileFingerprint(filePath)
        let contentType = getContentTypeFromMimeMap(mimeType, contentTypeMap)
        contentType = isLargeFile ? null : contentType

        // 4.3 构建基础文件信息
        const baseFile: UniversalFile = {
          fileName,
          mimeType,
          fileSize: fileStats.size,
          localPath: filePath,
          contentType: contentType,
          content: undefined,
          fingerprint
        }

        // 4.4 若需要读取内容且不是大文件，根据 contentType 转换格式
        if (contentType !== null && !isLargeFile) {
          // 先读取文件为 Buffer
          const fileBuffer = await fs.readFile(filePath)

          // 根据目标格式转换内容
          switch (contentType) {
            case 'ArrayBuffer':
              // Buffer 转 ArrayBuffer
              baseFile.content = fileBuffer.buffer.slice(
                fileBuffer.byteOffset,
                fileBuffer.byteOffset + fileBuffer.byteLength
              ) as ArrayBuffer
              break
            case 'Text':
              // Buffer 转 UTF8 字符串
              baseFile.content = fileBuffer.toString('utf8')
              break
            case 'Base64':
              // Buffer 转 Base64 字符串
              baseFile.content = fileBuffer.toString('base64')
              break
          }
        } else if (isLargeFile) {
          // 大文件处理：明确设置content为null
          baseFile.content = undefined
        }

        universalFiles.push(baseFile)
      } catch (fileError) {
        console.error(`处理文件 ${filePath} 失败:`, fileError)
        // 单个文件处理失败不中断整体流程，仅跳过该文件
      }
    }

    return { isSuccess: true, data: universalFiles }
  } catch (error) {
    return {
      isSuccess: false,
      msg: `打开文件选择器失败: ${error instanceof Error ? error.message : String(error)}`
    }
  }
}

const openImageWithSystemViewer = async (absolutePath): Promise<boolean> => {
  try {
    // 检查文件是否存在
    await fs.access(absolutePath)

    // 调用系统默认程序打开图片（会自动使用默认图片查看器）
    const success = await shell.openPath(absolutePath)

    if (success) {
      console.log(`成功打开图片: ${absolutePath}`)
      return true
    } else {
      console.error(`打开图片失败: 系统无法处理该请求`)
      return false
    }
  } catch (error) {
    console.error(`打开图片出错:`, error)
    return false
  }
}

/**
 * 注册文件管理相关的 IPC 通信句柄（主进程 <-> 渲染进程）
 */
export function registerFileManageIpcHandlers(): void {
  // 获取用户文件
  ipcMain.handle(
    'getUserFile',
    async (
      _event,
      fileName: string,
      contentType: null | 'ArrayBuffer' | 'Base64' | 'Text'
    ): Promise<ApiResult<UniversalFile>> => {
      return getUserFile(fileName, contentType)
    }
  )

  // 获取头像文件
  ipcMain.handle(
    'getAvatar',
    async (
      _event,
      fileName: string,
      contentType: null | 'ArrayBuffer' | 'Base64' = 'Base64'
    ): Promise<ApiResult<UniversalFile>> => {
      return getAvatar(fileName, contentType)
    }
  )

  // 上传用户文件
  ipcMain.handle(
    'uploadUserFile',
    async (_event, file: UniversalFile): Promise<ApiResult<UniversalFile>> => {
      console.log('ipcMain.handle.uploadUserFile')
      return uploadUserFile(file)
    }
  )

  // 上传头像文件
  ipcMain.handle(
    'uploadAvatar',
    async (_event, file: UniversalFile): Promise<ApiResult<UniversalFile>> => {
      return uploadAvatar(file)
    }
  )

  // 打开文件选择器
  ipcMain.handle(
    'openFileDialog',
    async (_event, map: MimeContentTypeMap): Promise<ApiResult<UniversalFile[]>> => {
      return openFileDialog(map)
    }
  )

  // 打开文件选择器
  ipcMain.handle('openImageViewer', async (_event, fileName: string): Promise<void> => {
    const relPath = localFileManager.getUserFileDir()
    openImageWithSystemViewer(path.join(relPath, fileName))
  })
}
