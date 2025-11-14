import { ApiResult, MimeContentTypeMap, UniversalFile } from '@shared/types'
import path from 'path'
import sharp from 'sharp'
import fs, { access } from 'fs/promises'
import { BrowserWindow, dialog, OpenDialogOptions, shell } from 'electron'
import { calculateFileFingerprintByContent, getMIMEFromFilename, MIME } from '@shared/utils'
import { createHash } from 'crypto'
import { createReadStream } from 'fs'
import ffmpeg from 'fluent-ffmpeg'
import ffmpegPath from 'ffmpeg-static'
import { file } from 'tmp-promise'

// 关键：判断ffmpegPath是否有效，消除类型错误
if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath)
}

// 头像压缩配置
const AVATAR_COMPRESS_CONFIG = {
  width: 128, // 目标宽度
  height: 128, // 目标高度
  quality: 80 // 压缩质量 (0-100)
}

/**
 * 压缩图片为指定尺寸（输入输出均为 ArrayBuffer 类型）
 * @param file 原始图片文件（符合 UniversalFile 规范）
 * @returns 压缩后的图片文件（content 为 ArrayBuffer）
 */
export const compressImage = async (file: UniversalFile): Promise<UniversalFile> => {
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
    imageBuffer = Buffer.from(file.content)
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
    fileSize: compressedArrayBuffer.byteLength, // 使用 ArrayBuffer 实际长度
    fingerprint: await calculateFileFingerprintByContent(compressedArrayBuffer as ArrayBuffer)
  }
}

/**
 * ArrayBuffer 转 Buffer（仅用于 sharp 等依赖 Buffer 的底层库）
 * @param arrayBuffer 待转换的 ArrayBuffer
 * @returns 转换后的 Buffer
 */
export const arrayBufferToBuffer = (arrayBuffer: ArrayBuffer): Buffer => {
  return Buffer.from(arrayBuffer)
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
 * 不加载完整文件到内存，通过流式读取计算文件 SHA-256 指纹（Electron Node.js 环境）
 * @param filePath 本地文件的绝对路径（如 'C:/Users/file.zip' 或 '/home/user/file.txt'）
 * @returns 文件的 SHA-256 指纹（小写十六进制字符串）
 */
export const calculateFileFingerprintWithoutLoad = async (filePath: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    // 创建 SHA-256 哈希计算对象
    const hash = createHash('sha256')

    // 创建文件读取流（默认 64KB 分片，可根据内存情况调整）
    // highWaterMark 控制每次读取的字节数，64KB 是平衡性能和内存的常用值
    const readStream = createReadStream(filePath, { highWaterMark: 64 * 1024 })

    // 每读取一块数据，就更新哈希状态（仅加载当前分片到内存）
    readStream.on('data', (chunk) => {
      // chunk 是 Buffer 类型，直接传入 hash.update 进行增量计算
      hash.update(chunk)
    })

    // 文件读取完成，计算最终哈希值
    readStream.on('end', () => {
      // 生成十六进制格式的指纹字符串
      const fingerprint = hash.digest('hex')
      resolve(fingerprint)
    })

    // 处理读取错误（如文件不存在、权限不足等）
    readStream.on('error', (error) => {
      console.error(
        `[calculateFileFingerprintWithoutLoad] 读取文件失败（路径：${filePath}）:`,
        error
      )
      reject(new Error(`计算文件指纹失败：${error.message}`))
    })
  })
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
        const isLargeFile = fileStats.size > CRITICAL // 判断是否大于限制

        let contentType = getContentTypeFromMimeMap(mimeType, contentTypeMap)
        contentType = isLargeFile ? null : contentType

        // 4.3 构建基础文件信息
        const baseFile: UniversalFile = {
          fileName,
          mimeType,
          fileSize: fileStats.size,
          localPath: filePath,
          contentType: contentType,
          content: undefined
        }

        // 4. 若需要读取内容且不是大文件，根据 contentType 转换格式
        if (isLargeFile || contentType == null) {
          baseFile.contentType = null
          baseFile.content = undefined
          baseFile.fingerprint = await calculateFileFingerprintWithoutLoad(filePath)
        } else {
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
          // 计算文件指纹
          baseFile.fingerprint = await calculateFileFingerprintByContent(baseFile.content)
        }
        const is64BitFingerprint = /^[0-9a-fA-F]{64}$/.test(baseFile.fingerprint)
        if (!is64BitFingerprint) {
          throw new Error('文件指纹计算异常')
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

/**
 * 生成文件缩略图（基于 sharp，零系统依赖）
 * @param filePath 源文件路径
 * @param targetRatio 目标尺寸比例 [宽, 高]，如 [16,9]，为 null 则适配原图
 * @param targetMaxWidth 目标输出最大宽度(像素)，如128，高度结合targetRatio计算可得
 * @param contentType 返回内容格式，支持'Base64' | 'ArrayBuffer'，默认 Base64
 * @returns 缩略图的 UniversalFile 对象
 */
export const generateFileThumbnail = async (
  filePath: string,
  contentType: 'Base64' | 'ArrayBuffer' = 'Base64',
  targetMaxWidth: number = 200,
  targetRatio?: [number, number]
): Promise<UniversalFile> => {
  // 1. 验证文件存在性
  try {
    await fs.access(filePath)
  } catch {
    throw new Error(`文件不存在或无法访问: ${filePath}`)
  }

  // 2. 获取文件基础信息
  const fileName = path.basename(filePath)
  const mimeType = getMIMEFromFilename(fileName)
  if (!mimeType?.startsWith('image/')) {
    throw new Error(`不支持的文件类型（仅支持图片）: ${mimeType}`)
  }

  // 3. 读取原图元数据（获取宽高）
  const image = sharp(filePath)
  const { width: originalWidth, height: originalHeight } = await image.metadata()
  if (!originalWidth || !originalHeight) {
    throw new Error(`无法获取图片尺寸: ${filePath}`)
  }

  // 4. 计算缩略图尺寸
  // 4.1 确定最终使用的比例（优先 targetRatio，否则用原图比例）
  const [ratioWidth, ratioHeight] = targetRatio || [originalWidth, originalHeight]
  const finalRatio = ratioWidth / ratioHeight // 宽高比（>1 表示宽屏，<1 表示竖屏）

  // 4.2 根据 targetMaxWidth 和比例计算最终尺寸
  let thumbnailWidth: number, thumbnailHeight: number
  if (originalWidth <= targetMaxWidth) {
    // 原图宽度小于最大限制，直接使用原图尺寸（按比例缩放）
    thumbnailWidth = originalWidth
    thumbnailHeight = Math.round(thumbnailWidth / finalRatio)
  } else {
    // 原图宽度超限，按最大宽度等比缩放
    thumbnailWidth = targetMaxWidth
    thumbnailHeight = Math.round(thumbnailWidth / finalRatio)
  }

  // 5. 生成缩略图（自动保持比例，不裁剪）
  const resizedImage = image.resize(thumbnailWidth, thumbnailHeight, {
    fit: 'inside', // 确保图片完全在指定尺寸内
    withoutEnlargement: true // 不放大图片（原图小于目标尺寸时保持原样）
  })

  // 6. 处理输出内容
  const rawBuffer = await resizedImage.toBuffer()
  let content: string | ArrayBuffer

  switch (contentType) {
    case 'ArrayBuffer':
      content = rawBuffer.buffer.slice(
        rawBuffer.byteOffset,
        rawBuffer.byteOffset + rawBuffer.byteLength
      ) as ArrayBuffer
      break
    case 'Base64':
      content = rawBuffer.toString('base64')
      break
    default:
      throw new Error(`不支持的内容格式: ${contentType}`)
  }

  // 7. 计算文件指纹
  const fingerprint = await calculateFileFingerprintByContent(content)

  // 8. 返回结果（包含实际尺寸）
  return {
    fileName: `thumbnail_${fileName}`,
    mimeType,
    fileSize: rawBuffer.length,
    contentType,
    content,
    localPath: '',
    fingerprint
  }
}

/**
 * 提取视频第一帧并生成缩略图
 * 依赖：需提前安装ffmpeg
 */
export const generateVideoThumbnail = async (
  filePath: string,
  contentType: 'Base64' | 'ArrayBuffer' = 'Base64',
  targetMaxWidth: number = 200,
  targetRatio?: [number, number]
): Promise<UniversalFile | null> => {
  // 1. 验证文件存在性
  try {
    await access(filePath)
  } catch {
    throw new Error(`文件不存在或无法访问: ${filePath}`)
  }
  if (!ffmpegPath) return null

  // 2. 创建临时文件（用于存储ffmpeg提取的帧）
  const { path: tempFramePath, cleanup } = await file({
    postfix: '.jpg' // 临时文件后缀（确保是图片格式）
  })

  try {
    // 3. 用ffmpeg提取帧到临时文件
    await new Promise<void>((resolve, reject) => {
      ffmpeg(filePath)
        .seekInput(0.5) // 从0.5秒提取（避开开头无帧的情况）
        .frames(1) // 只取1帧
        .output(tempFramePath) // 输出到临时文件
        .outputOptions([
          '-pix_fmt yuv420p', // 仅保留格式兼容参数
          '-y' // 覆盖已有文件
        ])
        // 移除所有滤镜相关参数，避免解析错误
        .on('end', () => resolve())
        .on('error', (err) => reject(new Error(`ffmpeg处理失败: ${err.message}`)))
        .run()
    })

    // 4. 验证临时文件是否有效（避免空文件）
    const frameBuffer = await sharp(tempFramePath).toBuffer() // 读取临时文件
    if (frameBuffer.length === 0) {
      throw new Error('提取的视频帧为空，可能视频格式不支持或损坏')
    }

    // 5. 用sharp处理帧数据（后续逻辑与之前一致）
    const frameImage = sharp(frameBuffer)
    const { width: originalWidth, height: originalHeight } = await frameImage.metadata()
    if (!originalWidth || !originalHeight) {
      throw new Error('无法获取视频帧尺寸')
    }

    // 6. 计算缩略图尺寸
    const [ratioWidth, ratioHeight] = targetRatio || [originalWidth, originalHeight]
    const finalRatio = ratioWidth / ratioHeight

    let thumbnailWidth: number, thumbnailHeight: number
    if (originalWidth <= targetMaxWidth) {
      thumbnailWidth = originalWidth
      thumbnailHeight = Math.round(thumbnailWidth / finalRatio)
    } else {
      thumbnailWidth = targetMaxWidth
      thumbnailHeight = Math.round(thumbnailWidth / finalRatio)
    }

    // 7. 压缩图片
    const resizedBuffer = await frameImage
      .resize(thumbnailWidth, thumbnailHeight, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality: 80 })
      .toBuffer()

    // 8. 处理输出内容
    let content: string | ArrayBuffer
    switch (contentType) {
      case 'ArrayBuffer':
        content = resizedBuffer.buffer.slice(
          resizedBuffer.byteOffset,
          resizedBuffer.byteOffset + resizedBuffer.byteLength
        ) as ArrayBuffer
        break
      case 'Base64':
        content = resizedBuffer.toString('base64')
        break
      default:
        throw new Error(`不支持的内容格式: ${contentType}`)
    }

    // 9. 计算文件指纹
    const fingerprint = await calculateFileFingerprintByContent(content)

    // 10. 返回结果
    return {
      fileName: `thumbnail_${fingerprint}.jpg`,
      mimeType: 'image/jpeg',
      fileSize: resizedBuffer.length,
      contentType,
      content,
      localPath: '',
      fingerprint
    }
  } finally {
    // 无论成功失败，都删除临时文件
    await cleanup()
  }
}

/**
 * 打开图片查看器
 * @returns 包含选中文件列表的 ApiResult
 */
export const openImageWithSystemViewer = async (absolutePath): Promise<boolean> => {
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
