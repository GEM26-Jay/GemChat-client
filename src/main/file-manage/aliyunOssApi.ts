import OSS, { MultipartUploadOptions, GetObjectResult } from 'ali-oss'
import fs from 'fs'
import fsPromises from 'fs/promises'
import path from 'path'
import { ApiResult, FileToken } from '@shared/types'

// 配置常量
const UPLOAD_CHUNK_SIZE = 5 * 1024 * 1024 // 5MB 分片大小
const CONCURRENT_UPLOADS = 3 // 并发上传数量
const LARGE_FILE_THRESHOLD = UPLOAD_CHUNK_SIZE // 超过此大小使用分片上传
const DOWNLOAD_CHUNK_SIZE = 5 * 1024 * 1024 // 5MB 分片下载大小
const MAX_RETRY = 3 // 分片下载失败重试次数

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
 * 确保目录可写，不存在则创建
 */
async function ensureWritableDir(filePath: string): Promise<void> {
  const dir = path.dirname(filePath)
  try {
    await fsPromises.access(dir, fs.constants.W_OK)
  } catch {
    await fsPromises.mkdir(dir, { recursive: true })
  }
}

/**
 * 分片上传文件
 */
async function multipartUpload(
  client: OSS,
  objectPath: string,
  filePath: string,
  fileSize: number,
  onProgress: (value: number) => unknown // 接收进度回调
): Promise<void> {
  // 小文件直接上传
  if (fileSize <= LARGE_FILE_THRESHOLD) {
    onProgress(0) // 开始上传（进度0%）
    await client.put(objectPath, filePath)
    onProgress(100) // 上传完成（进度100%）
    return
  }

  // 大文件分片上传配置（触发进度回调）
  const options: MultipartUploadOptions = {
    parallel: CONCURRENT_UPLOADS,
    partSize: UPLOAD_CHUNK_SIZE,
    progress: (p: number) => {
      const progress = Math.floor(p * 100)
      console.log(`上传进度: ${progress}%`)
      onProgress(progress) // 实时传递分片进度
    }
  }

  onProgress(0) // 开始上传（进度0%）

  const result = await client.multipartUpload(objectPath, filePath, options)
  if (result.res.status !== 200) {
    throw new Error(`上传失败，状态码: ${result.res.status}`)
  }
  onProgress(100) // 上传完成（进度100%）
}

/**
 * 分片下载文件（补充进度回调触发）
 */
async function downloadInChunks(
  client: OSS,
  objectPath: string,
  localFilePath: string,
  totalSize: number,
  onProgress: (value: number) => unknown // 接收进度回调
): Promise<void> {
  await ensureWritableDir(localFilePath)
  const writeStream = fs.createWriteStream(localFilePath)

  try {
    let downloadedSize = 0
    let partNumber = 1

    onProgress(0) // 开始下载（进度0%）

    while (downloadedSize < totalSize) {
      const start = downloadedSize
      const end = Math.min(start + DOWNLOAD_CHUNK_SIZE - 1, totalSize - 1)
      console.log(`下载分片 ${partNumber}：${start}-${end}`)

      // 带重试机制的分片下载
      let chunkContent: Buffer | null = null
      let retryCount = 0

      while (retryCount < MAX_RETRY) {
        try {
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
            throw new Error(`分片 ${partNumber} 下载失败(已重试${MAX_RETRY}次): ${error}`)
          }
          await new Promise((resolve) => setTimeout(resolve, 1000 * retryCount))
        }
      }

      if (!chunkContent) throw new Error(`分片 ${partNumber} 内容为空`)

      // 写入分片内容
      await new Promise((resolve, reject) => {
        writeStream.write(chunkContent, (err) => (err ? reject(err) : resolve(true)))
      })

      downloadedSize += chunkContent.length
      partNumber++
      const progress = Math.floor((downloadedSize / totalSize) * 100)
      console.log(`下载进度：${progress}%`)
      onProgress(progress) // 实时传递下载进度
    }

    await new Promise((resolve, reject) => {
      writeStream.end((err) => (err ? reject(err) : resolve(true)))
    })
    onProgress(100) // 下载完成（进度100%）
  } catch (error) {
    writeStream.destroy()
    await fsPromises.unlink(localFilePath).catch(() => {}) // 清理不完整文件
    throw error
  }
}

/**
 * 上传文件到OSS
 * @param token 上传凭证
 * @param filePath 本地文件路径
 * @param onProgress 进度回调（0-100的数值）
 * @param onError 错误回调（无参数，仅通知错误发生）
 */
export async function ossUpload(
  token: FileToken,
  filePath: string,
  onProgress: (value: number) => unknown,
  onError: () => unknown
): Promise<ApiResult<void>> {
  try {
    // 基本校验
    if (!token.path) {
      const msg = 'token缺少路径信息'
      console.error(msg)
      return { isSuccess: false, errType: 'business', msg }
    }
    if (!filePath) {
      const msg = '文件路径不能为空'
      console.error(msg)
      return { isSuccess: false, errType: 'business', msg }
    }

    // 检查文件是否存在
    try {
      await fsPromises.access(filePath, fs.constants.F_OK)
    } catch {
      const msg = `本地文件不存在: ${filePath}`
      console.error(msg)
      return { isSuccess: false, errType: 'business', msg }
    }

    // 检查token有效性
    if (checkExpire(token)) {
      const msg = '上传令牌已过期'
      console.error(msg)
      return { isSuccess: false, errType: 'business', msg }
    }

    // 如果文件已存在则直接返回成功（触发100%进度）
    if (token.exist) {
      onProgress(100)
      return { isSuccess: true }
    }

    // 获取文件大小并执行上传
    const stats = await fsPromises.stat(filePath)
    const client = createOssClient(token)
    // await multipartUpload(client, token.path, filePath, stats.size, () => {})
    multipartUpload(client, token.path, filePath, stats.size, onProgress)

    return { isSuccess: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('文件上传失败:', message)
    onError() // 触发错误回调
    return { isSuccess: false, errType: 'business', msg: `上传失败: ${message}` }
  }
}

/**
 * 从OSS下载文件
 * @param token 下载凭证
 * @param targetDir 本地保存目录
 * @param onProgress 进度回调（0-100的数值）
 * @param onError 错误回调（无参数，仅通知错误发生）
 */
export async function ossDownload(
  token: FileToken,
  targetDir: string,
  onProgress: (value: number) => unknown,
  onError: () => unknown
): Promise<ApiResult<void>> {
  try {
    // 基本校验
    if (!token.path) {
      const msg = 'token缺少路径信息'
      console.error(msg)
      return { isSuccess: false, errType: 'business', msg }
    }
    if (!targetDir) {
      const msg = '目标目录不能为空'
      console.error(msg)
      return { isSuccess: false, errType: 'business', msg }
    }
    if (!token.name) {
      const msg = 'token缺少文件名'
      console.error(msg)
      return { isSuccess: false, errType: 'business', msg }
    }

    // 检查文件是否存在
    if (!token.exist) {
      const msg = `文件不存在: ${token.name}`
      console.error(msg)
      return { isSuccess: false, errType: 'business', msg }
    }

    // 检查token有效性
    if (checkExpire(token)) {
      const msg = '下载令牌已过期'
      console.error(msg)
      return { isSuccess: false, errType: 'business', msg }
    }

    // 构建本地文件路径
    const localFilePath = path.join(targetDir, token.name)
    const client = createOssClient(token)
    const fileSize = token.size || 0

    // 小文件直接下载（触发进度回调）
    if (fileSize <= DOWNLOAD_CHUNK_SIZE || fileSize === 0) {
      onProgress(0) // 开始下载
      const { content, res } = (await client.get(token.path)) as GetObjectResult
      if (res.status !== 200) {
        const msg = `下载失败，状态码: ${res.status}`
        console.error(msg)
        throw new Error(msg)
      }
      await ensureWritableDir(localFilePath)
      await fsPromises.writeFile(localFilePath, content)
      onProgress(100) // 下载完成
      return { isSuccess: true }
    }

    // 大文件分片下载（触发进度回调）
    await downloadInChunks(client, token.path, localFilePath, fileSize, onProgress)
    return { isSuccess: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('文件下载失败:', message)
    onError() // 触发错误回调
    return { isSuccess: false, errType: 'business', msg: `下载失败: ${message}` }
  }
}
