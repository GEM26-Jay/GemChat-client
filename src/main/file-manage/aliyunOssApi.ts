import OSS, { MultipartUploadOptions, GetObjectResult } from 'ali-oss'
import fs from 'fs'
import fsPromises from 'fs/promises'
import path from 'path'
import { ApiResult, FileToken, UniversalFile } from '@shared/types'
import { getMIMEFromFilename } from '@shared/utils'
import { FileUploadDTO } from '@shared/DTO.types'
import {
  getOssAvatarDownloadToken,
  getOssAvatarUploadToken,
  getOssdownloadToken,
  getOssUploadToken,
  insertOSSDb
} from '../axios/axiosOssApi'

// ------------------------------
// 配置常量
// ------------------------------
// 上传配置
const UPLOAD_CHUNK_SIZE = 5 * 1024 * 1024 // 5MB 分片大小
const CONCURRENT_UPLOADS = 3 // 并发上传数量
const LARGE_FILE_THRESHOLD = UPLOAD_CHUNK_SIZE // 超过此大小使用分片上传

// 下载配置
const DOWNLOAD_CHUNK_SIZE = 5 * 1024 * 1024 // 5MB 分片大小
const MAX_RETRY = 3 // 分片下载失败重试次数

// ------------------------------
// 工具函数
// ------------------------------
/**
 * 检查Token是否过期（提前1分钟失效）
 */
function checkExpire(token: FileToken): boolean {
  if (!token?.expiration) return true
  const expirationTime = new Date(token.expiration).getTime()
  const currentTime = Date.now()
  return currentTime >= expirationTime - 60 * 1000
}

/**
 * 创建OSS客户端实例
 * 直接使用Token中提供的region和bucket
 */
function createOssClient(token: FileToken): OSS {
  return new OSS({
    region: token.region,
    bucket: token.bucket,
    accessKeyId: token.accessKeyId,
    accessKeySecret: token.accessKeySecret,
    stsToken: token.securityToken,
    secure: true
  })
}

/**
 * 数据类型转换工具
 */
const DataConverter = {
  arrayBufferToBuffer: (arrayBuffer: ArrayBuffer): Buffer => Buffer.from(arrayBuffer),
  bufferToArrayBuffer: (buffer: Buffer): ArrayBuffer =>
    buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer,
  bufferToBase64: (buffer: Buffer): string => buffer.toString('base64'),
  bufferToText: (buffer: Buffer): string => buffer.toString('utf8'),
  textToBuffer: (text: string): Buffer => Buffer.from(text, 'utf8'),
  base64ToBuffer: (base64: string): Buffer => Buffer.from(base64, 'base64')
}

// ------------------------------
// 上传相关方法
// ------------------------------
/**
 * 读取文件内容（支持本地路径和内存内容）
 */
async function readFileContent(file: UniversalFile): Promise<{
  content: Buffer | fs.ReadStream
  fileSize: number
  isStream: boolean
}> {
  // 优先使用内存中的内容
  if (file.contentType && ['Text', 'Base64', 'ArrayBuffer'].includes(file.contentType)) {
    let buffer: Buffer
    switch (file.contentType) {
      case 'Text':
        buffer = DataConverter.textToBuffer(file.content as string)
        break
      case 'Base64':
        buffer = DataConverter.base64ToBuffer(file.content as string)
        break
      case 'ArrayBuffer':
        buffer = DataConverter.arrayBufferToBuffer(file.content as ArrayBuffer)
        break
      default:
        throw new Error(`不支持的contentType: ${file.contentType}`)
    }
    return {
      content: buffer,
      fileSize: buffer.length,
      isStream: false
    }
  }

  // 从本地路径读取文件
  if (!file.localPath) {
    throw new Error('文件内容和本地路径不能同时为空')
  }

  // 验证本地文件是否存在
  try {
    await fsPromises.access(file.localPath, fs.constants.F_OK)
  } catch {
    throw new Error(`本地文件不存在: ${file.localPath}`)
  }

  // 获取文件大小
  const stats = await fsPromises.stat(file.localPath)

  return {
    content: fs.createReadStream(file.localPath, { highWaterMark: UPLOAD_CHUNK_SIZE }),
    fileSize: stats.size,
    isStream: true
  }
}

/**
 * 分片上传大文件
 */
async function multipartUpload(
  client: OSS,
  path: string,
  content: Buffer | fs.ReadStream,
  fileSize: number,
  isStream: boolean
): Promise<void> {
  // 小文件直接使用简单上传
  if (fileSize <= LARGE_FILE_THRESHOLD) {
    await client.put(path, content)
    return
  }

  // 大文件使用分片上传
  const options: MultipartUploadOptions = {
    parallel: CONCURRENT_UPLOADS,
    partSize: UPLOAD_CHUNK_SIZE,
    progress: (p: number) => {
      console.log(`上传进度: ${Math.floor(p * 100)}%`)
    }
  }

  // 流式上传处理
  if (isStream && content instanceof fs.ReadStream) {
    const result = await client.multipartUpload(path, content, options)
    if (result.res.status !== 200) {
      throw new Error(`分片上传失败，状态码: ${result.res.status}`)
    }
    return
  }

  // Buffer分片上传
  if (!isStream && content instanceof Buffer) {
    const result = await client.multipartUpload(path, content, options)
    if (result.res.status !== 200) {
      throw new Error(`分片上传失败，状态码: ${result.res.status}`)
    }
    return
  }

  throw new Error('不支持的文件内容类型')
}

/**
 * 通用文件上传处理（支持大文件分片上传）
 */
async function uploadFileCommon(
  file: UniversalFile,
  getToken: (dto: FileUploadDTO) => Promise<ApiResult<FileToken>>,
  tokenErrorMsg: string,
  allowedContentTypes: string[]
): Promise<ApiResult<UniversalFile>> {
  // 参数校验
  if (!file.fileName) {
    return { isSuccess: false, errType: 'business', msg: '文件名不能为空' }
  }

  // 验证内容类型或本地路径
  if (!file.contentType && !file.localPath) {
    return {
      isSuccess: false,
      errType: 'business',
      msg: '文件contentType和localPath不能同时为空'
    }
  }

  if (file.contentType && !allowedContentTypes.includes(file.contentType)) {
    return {
      isSuccess: false,
      errType: 'business',
      msg: `不支持的contentType: ${file.contentType}，允许类型: ${allowedContentTypes.join(',')}`
    }
  }

  try {
    // 读取文件内容
    const { content, fileSize, isStream } = await readFileContent(file)

    // 获取上传令牌（使用实际文件大小）
    const uploadDto: FileUploadDTO = {
      name: file.fileName,
      size: fileSize,
      mimeType: file.mimeType || getMIMEFromFilename(file.fileName) || 'application/octet-stream',
      fingerprint: file.fingerprint || ''
    }

    const apiResult = await getToken(uploadDto)
    if (!apiResult.isSuccess || !apiResult.data) {
      return { ...apiResult, data: undefined, msg: apiResult.msg || tokenErrorMsg }
    }

    const token = apiResult.data as FileToken
    if (!token.exist) {
      if (checkExpire(token)) {
        return { isSuccess: false, errType: 'business', msg: '上传令牌已过期' }
      }
      // 执行上传
      const client = createOssClient(token)
      await multipartUpload(client, token.path, content, fileSize, isStream)

      // 关闭可能打开的流
      if (isStream && content instanceof fs.ReadStream) {
        content.destroy()
      }
    }
    const newFileUploadDto: FileUploadDTO = { ...uploadDto, name: token.name, path: token.path }
    await insertOSSDb(newFileUploadDto)
    return {
      isSuccess: true,
      data: { ...file, fileName: token.name, fileSize }
    }
  } catch (error) {
    console.error('文件上传失败:', error)
    return {
      isSuccess: false,
      errType: 'business',
      msg: `文件上传失败: ${error instanceof Error ? error.message : String(error)}`
    }
  }
}

// ------------------------------
// 下载相关方法
// ------------------------------
/**
 * 验证本地目录是否可写
 */
async function ensureWritableDir(filePath: string): Promise<void> {
  const dir = path.dirname(filePath)
  try {
    await fsPromises.access(dir, fs.constants.W_OK)
  } catch {
    // 目录不存在则创建
    await fsPromises.mkdir(dir, { recursive: true })
  }
}

/**
 * 分片下载大文件并写入本地
 */
async function downloadInChunks(
  client: OSS,
  objectPath: string,
  localFilePath: string,
  totalSize: number
): Promise<void> {
  // 确保目标目录可写
  await ensureWritableDir(localFilePath)

  // 创建文件写入流（覆盖模式）
  const writeStream = fs.createWriteStream(localFilePath)

  try {
    let downloadedSize = 0
    let partNumber = 1

    // 循环下载所有分片
    while (downloadedSize < totalSize) {
      const start = downloadedSize
      const end = Math.min(start + DOWNLOAD_CHUNK_SIZE - 1, totalSize - 1) // 闭区间[start, end]
      const contentLength = end - start + 1

      console.log(
        `下载分片 ${partNumber}：${start}-${end}（${(contentLength / 1024 / 1024).toFixed(2)}MB）`
      )

      // 带重试的分片下载
      let retryCount = 0
      let chunkContent: Buffer | null = null

      while (retryCount < MAX_RETRY) {
        try {
          // 请求指定范围的文件内容（HTTP Range请求）
          const { content, res } = (await client.get(objectPath, {
            range: `bytes=${start}-${end}`
          })) as GetObjectResult

          if (res.status !== 206 && res.status !== 200) {
            throw new Error(`分片下载失败，状态码: ${res.status}`)
          }

          chunkContent = content
          break
        } catch (error) {
          retryCount++
          if (retryCount >= MAX_RETRY) {
            throw new Error(
              `分片 ${partNumber} 下载失败（已重试${MAX_RETRY}次）：${(error as Error).message}`
            )
          }
          console.log(`分片 ${partNumber} 下载失败，重试第${retryCount}次...`)
          await new Promise((resolve) => setTimeout(resolve, 1000 * retryCount)) // 指数退避
        }
      }

      if (!chunkContent) {
        throw new Error(`分片 ${partNumber} 下载失败，无法获取内容`)
      }

      // 写入当前分片到文件流
      await new Promise((resolve, reject) => {
        writeStream.write(chunkContent!, (err) => {
          if (err) reject(err)
          else resolve(true)
        })
      })

      downloadedSize += chunkContent.length
      partNumber++

      // 输出下载进度
      const progress = Math.floor((downloadedSize / totalSize) * 100)
      console.log(
        `下载进度：${progress}%（${(downloadedSize / 1024 / 1024).toFixed(2)}MB/${(totalSize / 1024 / 1024).toFixed(2)}MB）`
      )
    }

    // 所有分片下载完成，关闭流
    await new Promise((resolve, reject) => {
      writeStream.end((err) => {
        if (err) reject(err)
        else resolve(true)
      })
    })

    console.log(`大文件下载完成：${localFilePath}`)
  } catch (error) {
    // 下载失败时删除不完整文件
    writeStream.destroy()
    await fsPromises.unlink(localFilePath).catch(() => {}) // 忽略删除失败（文件可能未创建）
    throw error
  }
}

/**
 * 通用文件下载处理（支持大文件分片下载）
 * 所有文件都存储到指定目录，仅返回操作结果状态
 */
async function downloadFileCommon(
  fileName: string,
  targetLocalDir: string,
  getToken: (fileName: string) => Promise<ApiResult<FileToken>>,
  notExistMsg: string
): Promise<ApiResult<void>> {
  try {
    // 参数校验：确保目标目录存在
    if (!targetLocalDir) {
      return {
        isSuccess: false,
        errType: 'business',
        msg: '必须指定本地保存目录（targetLocalDir）'
      }
    }

    // 构建完整的本地文件路径
    const localFilePath = path.join(targetLocalDir, fileName)

    // 获取下载令牌
    const apiResult = await getToken(fileName)
    if (!apiResult.isSuccess || !apiResult.data) {
      return { ...apiResult, data: undefined }
    }

    const token = apiResult.data
    if (checkExpire(token)) {
      return { isSuccess: false, errType: 'business', msg: '下载令牌已过期' }
    }

    if (!token.exist) {
      return { isSuccess: false, errType: 'business', msg: `${notExistMsg}: ${fileName}` }
    }

    const client = createOssClient(token)
    const objectPath = token.path
    const fileSize = token.size || 0 // 从令牌获取文件总大小

    // 确保目标目录存在
    await ensureWritableDir(localFilePath)

    // 小文件（≤5MB）直接下载并保存
    if (fileSize <= DOWNLOAD_CHUNK_SIZE || fileSize === 0) {
      console.log(
        `开始下载文件：${fileName}（${fileSize > 0 ? `${(fileSize / 1024).toFixed(2)}KB` : '大小未知'}）`
      )
      const { content, res } = (await client.get(objectPath)) as GetObjectResult

      if (res.status !== 200) {
        return {
          isSuccess: false,
          errType: 'business',
          msg: `文件下载失败，状态码: ${res.status}`
        }
      }

      // 写入本地文件
      await fsPromises.writeFile(localFilePath, content)
      console.log(`小文件下载完成：${localFilePath}`)

      return { isSuccess: true }
    }

    // 大文件（>5MB）分片下载到本地
    console.log(`开始分片下载大文件：${fileName}（${(fileSize / 1024 / 1024).toFixed(2)}MB）`)
    await downloadInChunks(client, objectPath, localFilePath, fileSize)

    return { isSuccess: true }
  } catch (error) {
    console.error(`文件下载失败（${fileName}）：`, error)
    return {
      isSuccess: false,
      errType: 'business',
      msg: `文件下载失败：${error instanceof Error ? error.message : String(error)}`
    }
  }
}

// ------------------------------
// 对外暴露的API
// ------------------------------
/**
 * 上传用户文件到阿里云OSS
 */
export function ossUploadFile(file: UniversalFile): Promise<ApiResult<UniversalFile>> {
  return uploadFileCommon(file, getOssUploadToken, '获取上传令牌失败', [
    'Text',
    'Base64',
    'ArrayBuffer'
  ])
}

/**
 * 从阿里云OSS下载用户文件（支持大文件分片）
 * @param fileName 文件名
 * @param targetLocalDir 本地保存路径（大文件必填）
 */
export function ossDownloadFile(
  fileName: string,
  targetLocalDir: string
): Promise<ApiResult<void>> {
  return downloadFileCommon(fileName, targetLocalDir, getOssdownloadToken, '文件不存在')
}

/**
 * 上传头像到阿里云OSS
 */
export function ossUploadAvatar(file: UniversalFile): Promise<ApiResult<UniversalFile>> {
  // 头像特殊校验
  const mimeType = file.mimeType || getMIMEFromFilename(file.fileName)
  if (mimeType && !mimeType.startsWith('image/')) {
    return Promise.resolve({
      isSuccess: false,
      errType: 'business',
      msg: `不支持的文件类型: ${mimeType}，请上传图片文件`
    })
  }

  return uploadFileCommon(file, getOssAvatarUploadToken, '获取头像上传令牌失败', [
    'Base64',
    'ArrayBuffer'
  ])
}

/**
 * 从阿里云OSS下载头像
 * @param fileName 头像文件名
 * @param targetLocalDir 本地保存路径（可选）
 */
export function ossDownloadAvatar(
  fileName: string,
  targetLocalDir?: string
): Promise<ApiResult<void>> {
  return downloadFileCommon(
    fileName,
    targetLocalDir || path.join('./avatars', fileName), // 头像默认保存路径
    getOssAvatarDownloadToken,
    '头像文件不存在'
  )
}
