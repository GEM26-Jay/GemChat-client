import { ApiResult, MIME, UniversalFile } from '@shared/types'
import { ossDownloadAvatar, ossDownloadFile, ossUploadAvatar, ossUploadFile } from './aliyunOssApi'
import {
  avatarExists,
  readAvatarLocal,
  readUserFileLocal,
  userFileExists,
  writeAvatarLocal,
  writeUserFileLocal
} from './localFileApi'
import { BrowserWindow, dialog, ipcMain, OpenDialogOptions } from 'electron'
import path from 'path'
import fs from 'fs/promises'
import sharp from 'sharp'

// 头像压缩配置
const AVATAR_COMPRESS_CONFIG = {
  width: 128, // 目标宽度
  height: 128, // 目标高度
  quality: 80 // 压缩质量 (0-100)
}
const extensionToMIME: Record<string, MIME> = {
  // 图片
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  bmp: 'image/bmp',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  // 文本/代码
  txt: 'text/plain',
  html: 'text/html',
  css: 'text/css',
  js: 'text/javascript',
  json: 'application/json',
  // 文档
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  // 压缩文件
  zip: 'application/zip',
  gz: 'application/gzip',
  tar: 'application/x-tar',
  '7z': 'application/x-7z-compressed',
  // 音视频
  mp3: 'audio/mpeg',
  mp4: 'video/mp4',
  mpeg: 'video/mpeg',
  // 字体
  ttf: 'font/ttf',
  woff: 'font/woff',
  woff2: 'font/woff2'
}

/**
 * 根据文件名获取 MIME 类型
 * @param filename 文件名（如 'image.jpg'、'data.json'、'document.PDF'）
 * @returns 对应的 MIME 类型，默认返回 'application/octet-stream'
 */
export function getMIMEFromFilename(filename: string): MIME {
  if (!filename) return 'application/octet-stream'

  // 提取扩展名（忽略大小写，如 'image.JPG' → 'jpg'）
  const lastDotIndex = filename.lastIndexOf('.')
  if (lastDotIndex === -1) return 'application/octet-stream' // 无扩展名

  const extension = filename.slice(lastDotIndex + 1).toLowerCase()

  // 查找映射表，未找到则返回默认类型
  return extensionToMIME[extension] || 'application/octet-stream'
}

/**
 * 压缩图片为指定尺寸
 * @param file 原始图片文件
 * @returns 压缩后的图片文件
 */
const compressImage = async (file: UniversalFile): Promise<UniversalFile> => {
  if (!file.content) {
    throw new Error('图片内容不能为空')
  }
  if (!file.mimeType?.startsWith('image/')) {
    throw new Error(`不支持的图片类型: ${file.mimeType}`)
  }

  // 准备原始图片Buffer
  let imageBuffer: Buffer
  if (file.contentType === 'Base64' && typeof file.content === 'string') {
    // 移除dataURL前缀
    imageBuffer = Buffer.from(file.content, 'base64')
  } else if (file.contentType === 'Buffer' && file.content instanceof Buffer) {
    imageBuffer = file.content
  } else {
    throw new Error(`不支持的图片内容格式: ${file.contentType}`)
  }

  // 压缩图片
  const compressedBuffer = await sharp(imageBuffer)
    .resize(AVATAR_COMPRESS_CONFIG.width, AVATAR_COMPRESS_CONFIG.height, {
      fit: 'cover', // 保持比例并填充尺寸
      withoutEnlargement: true, // 不放大小于目标尺寸的图片
      background: { r: 255, g: 255, b: 255, alpha: 0 }
    })
    .jpeg({ quality: AVATAR_COMPRESS_CONFIG.quality, mozjpeg: true })
    .toBuffer()

  // 返回压缩后的文件对象
  return {
    ...file,
    fileName: `${path.basename(file.fileName, path.extname(file.fileName))}.jpg`,
    mimeType: 'image/jpeg',
    content: compressedBuffer,
    contentType: 'Buffer',
    fileSize: compressedBuffer.length
  }
}

/**
 * 获取用户文件（优先本地，本地不存在则从OSS下载）
 */
export const getUserFile = async (
  fileName: string,
  contentType: null | 'Buffer' | 'Base64' | 'Text'
): Promise<ApiResult<UniversalFile>> => {
  try {
    // 检查本地文件是否存在
    const exists = await userFileExists(fileName)

    if (!exists) {
      // 本地不存在，从OSS下载
      const ossResult = await ossDownloadFile(fileName, contentType)
      if (!ossResult.isSuccess || !ossResult.data) {
        return {
          isSuccess: false,
          msg: ossResult.msg || 'OSS下载文件失败'
        }
      }

      // 下载成功后保存到本地
      const savedFile = await writeUserFileLocal(ossResult.data)
      return {
        isSuccess: true,
        data: savedFile
      }
    } else {
      // 本地存在，直接读取
      const localFile = await readUserFileLocal(fileName, contentType)
      return {
        isSuccess: true,
        data: localFile
      }
    }
  } catch (error) {
    return {
      isSuccess: false,
      msg: `获取文件失败: ${error instanceof Error ? error.message : String(error)}`
    }
  }
}

/**
 * 上传用户文件（同时上传OSS和本地保存）
 */
export const uploadUserFile = async (file: UniversalFile): Promise<ApiResult<UniversalFile>> => {
  try {
    // 先上传到OSS
    const ossResult = await ossUploadFile(file)
    if (!ossResult.isSuccess || !ossResult.data) {
      return {
        isSuccess: false,
        msg: ossResult.msg || 'OSS上传文件失败'
      }
    }

    // OSS上传成功后保存到本地
    const savedFile = await writeUserFileLocal(ossResult.data)
    return {
      isSuccess: true,
      data: savedFile
    }
  } catch (error) {
    return {
      isSuccess: false,
      msg: `上传文件失败: ${error instanceof Error ? error.message : String(error)}`
    }
  }
}

/**
 * 获取头像（优先本地，本地不存在则从OSS下载）
 */
export const getAvatar = async (
  fileName: string,
  contentType: null | 'Buffer' | 'Base64' = 'Base64'
): Promise<ApiResult<UniversalFile>> => {
  try {
    // 检查本地头像是否存在
    const exists = await avatarExists(fileName)

    if (!exists) {
      // 本地不存在，从OSS下载
      const ossResult = await ossDownloadAvatar(fileName, contentType)
      if (!ossResult.isSuccess || !ossResult.data) {
        return {
          isSuccess: false,
          msg: ossResult.msg || 'OSS下载头像失败'
        }
      }

      // 下载成功后保存到本地
      const savedAvatar = await writeAvatarLocal(ossResult.data)
      return {
        isSuccess: true,
        data: savedAvatar
      }
    } else {
      // 本地存在，直接读取
      const localAvatar = await readAvatarLocal(fileName, contentType)
      return {
        isSuccess: true,
        data: localAvatar
      }
    }
  } catch (error) {
    return {
      isSuccess: false,
      msg: `获取头像失败: ${error instanceof Error ? error.message : String(error)}`
    }
  }
}

/**
 * 上传头像（先压缩，再同时上传OSS和本地保存）
 */
export const uploadAvatar = async (file: UniversalFile): Promise<ApiResult<UniversalFile>> => {
  try {
    // 1. 先压缩图片
    const compressedFile = await compressImage(file)
    console.log(`头像压缩完成: ${compressedFile.fileName} (${compressedFile.fileSize} bytes)`)

    // 2. 上传压缩后的图片到OSS
    const ossResult = await ossUploadAvatar(compressedFile)
    if (!ossResult.isSuccess || !ossResult.data) {
      return {
        isSuccess: false,
        msg: ossResult.msg || 'OSS上传头像失败'
      }
    }

    // 3. OSS上传成功后，保存压缩后的图片到本地
    const savedAvatar = await writeAvatarLocal(ossResult.data)
    return {
      isSuccess: true,
      data: savedAvatar
    }
  } catch (error) {
    return {
      isSuccess: false,
      msg: `上传头像失败: ${error instanceof Error ? error.message : String(error)}`
    }
  }
}

/**
 * 打开文件选择器
 */
export const openFileDialog = async (
  contentType: null | 'Base64' | 'Text' | 'Buffer'
): Promise<ApiResult<UniversalFile[]>> => {
  try {
    // 获取当前聚焦的窗口作为对话框的父窗口
    const parentWindow = BrowserWindow.getFocusedWindow()

    // 配置文件选择对话框选项
    const options: OpenDialogOptions = {
      title: '选择文件',
      properties: ['openFile', 'multiSelections'] as const, // 允许选择多个文件
      filters: [{ name: '所有文件', extensions: ['*'] }]
    }

    if (!parentWindow) {
      return {
        isSuccess: false,
        msg: '主窗口未打开'
      }
    }

    // 打开文件选择对话框
    const result = await dialog.showOpenDialog(parentWindow, options)

    // 如果用户取消选择，返回空数组
    if (result.canceled || result.filePaths.length === 0) {
      return {
        isSuccess: true,
        data: []
      }
    }

    // 处理每个选中的文件，转换为UniversalFile
    const files: UniversalFile[] = []
    for (const filePath of result.filePaths) {
      try {
        // 获取文件基本信息
        const fileStats = await fs.stat(filePath)
        const fileName = path.basename(filePath)
        const mimeType: MIME = getMIMEFromFilename(fileName) || 'application/octet-stream'

        // 准备UniversalFile基础结构
        const universalFile: UniversalFile = {
          fileName,
          mimeType,
          fileSize: fileStats.size,
          localPath: filePath,
          contentType // 明确设置contentType
        }

        // 如果需要填充内容
        if (contentType !== null) {
          // 读取文件内容
          const buffer = await fs.readFile(filePath)

          // 根据指定类型设置content
          switch (contentType) {
            case 'Buffer':
              universalFile.content = buffer
              break

            case 'Text':
              // 文本类型直接转换为UTF8字符串
              universalFile.content = buffer.toString('utf8')
              break

            case 'Base64':
              // 二进制文件转为Base64
              universalFile.content = buffer.toString('base64')
              break
          }
        } else {
          // 不读取内容时清空content
          universalFile.content = undefined
        }

        files.push(universalFile)
      } catch (error) {
        console.error(`处理文件 ${filePath} 时出错:`, error)
      }
    }

    return {
      isSuccess: true,
      data: files
    }
  } catch (error) {
    return {
      isSuccess: false,
      msg: error instanceof Error ? error.message : '打开文件对话框时发生未知错误'
    }
  }
}

export function registerFileManageIpcHandlers(): void {
  ipcMain.handle(
    'getUserFile',
    async (
      _event,
      fileName: string,
      contentType: null | 'Buffer' | 'Base64' | 'Text'
    ): Promise<ApiResult<UniversalFile>> => {
      return getUserFile(fileName, contentType)
    }
  )
  ipcMain.handle(
    'getAvatar',
    async (
      _event,
      fileName: string,
      contentType: null | 'Buffer' | 'Base64'
    ): Promise<ApiResult<UniversalFile>> => {
      return getAvatar(fileName, contentType)
    }
  )
  ipcMain.handle(
    'uploadUserFile',
    async (_event, file: UniversalFile): Promise<ApiResult<UniversalFile>> => {
      const result = await uploadUserFile(file)
      return result
    }
  )
  ipcMain.handle(
    'uploadAvatar',
    async (_event, file: UniversalFile): Promise<ApiResult<UniversalFile>> => {
      const result = await uploadAvatar(file)
      return result
    }
  )
  ipcMain.handle(
    'openFileDialog',
    async (
      _event,
      contentType: null | 'Buffer' | 'Base64' | 'Text'
    ): Promise<ApiResult<UniversalFile[]>> => {
      return await openFileDialog(contentType)
    }
  )
}
