import OSS, { GetObjectResult } from 'ali-oss'
import {
  getOssAvatarDownloadToken,
  getOssAvatarUploadToken,
  getOssdownloadToken,
  getOssUploadToken
} from '../axios/axiosOssApi'
import { ApiResult, StsToken, UniversalFile, MIME } from '@shared/types'
import path from 'path'
import { getMIMEFromFilename } from './fileManage'

// 存储STS令牌，支持自动刷新
let downloadStsFileToken: StsToken = {} as StsToken
let downloadStsAvatarToken: StsToken = {} as StsToken

/**
 * 检查Token是否过期
 * @param token 需要检查的StsToken
 * @returns 过期返回true，有效返回false
 */
function checkExpire(token: StsToken): boolean {
  if (!token?.expiration) return true
  const expirationTime = new Date(token.expiration).getTime()
  const currentTime = new Date().getTime()
  // 提前5分钟视为过期，避免网络延迟导致的问题
  return currentTime >= expirationTime - 5 * 60 * 1000
}

/**
 * 从returnPath解析OSS配置信息
 * @param returnPath 后端返回的完整路径URL
 * @returns 包含region和bucket的配置对象
 */
function parseOssConfig(returnPath: string): { region: string; bucket: string } {
  try {
    const url = new URL(returnPath)
    const hostParts = url.hostname.split('.')
    const bucket = hostParts[0]
    const region = 'oss-' + hostParts[2]

    return { region, bucket }
  } catch (error) {
    throw new Error(`解析OSS配置失败: ${error instanceof Error ? error.message : '无效的URL格式'}`)
  }
}

/**
 * 创建 OSS 客户端的通用方法
 * @param token STS 令牌
 * @returns OSS 客户端实例
 */
function createOssClient(token: StsToken): OSS {
  const { region, bucket } = parseOssConfig(token.returnPath)
  return new OSS({
    region,
    bucket,
    accessKeyId: token.accessKeyId,
    accessKeySecret: token.accessKeySecret,
    stsToken: token.securityToken
  })
}

/**
 * 从returnPath获取对象路径
 * @param returnPath 后端返回的完整URL
 * @returns OSS对象路径
 */
function getObjectPath(returnPath: string): string {
  const url = new URL(returnPath)
  return url.pathname.substring(1) // 去除开头的斜杠
}

/**
 * 上传用户文件到阿里云OSS
 * @param file 符合UniversalFile类型的文件对象
 * @returns 包含上传结果的ApiResult
 */
export async function ossUploadFile(file: UniversalFile): Promise<ApiResult<UniversalFile>> {
  try {
    // 参数校验
    if (!file.fileName) {
      return {
        isSuccess: false,
        errType: 'business',
        msg: '文件名不能为空'
      }
    }
    if (file.content === undefined && file.contentType !== null) {
      return {
        isSuccess: false,
        errType: 'business',
        msg: '文件内容不能为空'
      }
    }

    // 获取上传令牌
    const apiResult = await getOssUploadToken(file.fileName)
    if (!apiResult.isSuccess || !apiResult.data) {
      return {
        ...apiResult,
        data: undefined,
        msg: apiResult.msg || '获取上传令牌失败'
      }
    }

    const token: StsToken = apiResult.data
    const client = createOssClient(token)
    const objectPath = getObjectPath(token.returnPath)
    const newFileName = path.basename(objectPath)

    // 处理不同类型的文件内容
    let uploadContent: Buffer | string

    switch (file.contentType) {
      case 'Text':
        if (typeof file.content !== 'string') {
          return {
            isSuccess: false,
            errType: 'business',
            msg: 'contentType为Text时，content必须是string'
          }
        }
        uploadContent = file.content
        break

      case 'Base64':
        if (typeof file.content !== 'string') {
          return {
            isSuccess: false,
            errType: 'business',
            msg: 'contentType为Base64时，content必须是string'
          }
        }
        uploadContent = Buffer.from(file.content, 'base64')
        break

      case 'Buffer':
        if (!(file.content instanceof Buffer)) {
          return {
            isSuccess: false,
            errType: 'business',
            msg: 'contentType为Buffer时，content必须是Buffer'
          }
        }
        uploadContent = file.content
        break

      default:
        return {
          isSuccess: false,
          errType: 'business',
          msg: `未处理的contentType: ${file.contentType}`
        }
    }

    // 执行上传
    await client.put(objectPath, uploadContent)

    // 返回更新后的文件信息
    return {
      isSuccess: true,
      data: {
        ...file,
        fileName: newFileName
      }
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

/**
 * 从阿里云OSS下载用户文件
 * @param fileName 文件名
 * @param contentType 期望的内容类型
 * @returns 包含下载结果的ApiResult
 */
export async function ossDownloadFile(
  fileName: string,
  contentType: null | 'Base64' | 'Text' | 'Buffer'
): Promise<ApiResult<UniversalFile>> {
  try {
    // 检查并刷新令牌
    if (checkExpire(downloadStsFileToken)) {
      const apiResult = await getOssdownloadToken()
      if (!apiResult.isSuccess || !apiResult.data) {
        return { ...apiResult, data: undefined }
      }
      downloadStsFileToken = apiResult.data
    }

    // 创建客户端并构建路径
    const client = createOssClient(downloadStsFileToken)
    const basePath = getObjectPath(downloadStsFileToken.returnPath)
    const objectPath = basePath.endsWith('/') ? `${basePath}${fileName}` : `${basePath}/${fileName}`

    // 下载文件
    const { content, res }: GetObjectResult = await client.get(objectPath)
    if (res.status !== 200) {
      return {
        isSuccess: false,
        msg: `OSS获取文件失败，状态码: ${res.status}`,
        errType: 'business'
      }
    }

    // 获取MIME类型
    const mimeType: MIME = getMIMEFromFilename(fileName) || 'application/octet-stream'

    // 不读取内容的情况
    if (contentType === null) {
      return {
        isSuccess: true,
        data: {
          fileName,
          mimeType,
          fileSize: content.length,
          content: undefined,
          contentType: null,
          fileId: objectPath
        }
      }
    }

    // 处理不同类型的返回内容
    let fileContent: string | Buffer

    switch (contentType) {
      case 'Text':
        fileContent = content.toString('utf8')
        break
      case 'Base64':
        fileContent = content.toString('base64')
        break
      case 'Buffer':
        fileContent = content
        break
      default:
        return {
          isSuccess: false,
          errType: 'business',
          msg: `不支持的contentType: ${contentType}`
        }
    }

    return {
      isSuccess: true,
      data: {
        fileName,
        mimeType,
        fileSize: content.length,
        content: fileContent,
        contentType,
        fileId: objectPath
      }
    }
  } catch (error) {
    console.error('文件下载失败:', error)
    return {
      isSuccess: false,
      msg: `文件下载失败: ${error instanceof Error ? error.message : String(error)}`,
      errType: 'business'
    }
  }
}

/**
 * 上传头像到阿里云OSS
 * @param file 符合UniversalFile类型的头像文件
 * @returns 包含上传结果的ApiResult
 */
export async function ossUploadAvatar(file: UniversalFile): Promise<ApiResult<UniversalFile>> {
  try {
    // 参数校验
    if (!file.fileName) {
      return {
        isSuccess: false,
        errType: 'business',
        msg: '头像文件名不能为空'
      }
    }
    if (file.content === undefined) {
      return {
        isSuccess: false,
        errType: 'business',
        msg: '头像内容不能为空'
      }
    }
    if (!file.mimeType?.startsWith('image/')) {
      return {
        isSuccess: false,
        errType: 'business',
        msg: `不支持的文件类型: ${file.mimeType}，请上传图片文件`
      }
    }
    if (!['Base64', 'Buffer'].includes(file.contentType || '')) {
      return {
        isSuccess: false,
        errType: 'business',
        msg: `头像仅支持Base64或Buffer类型，当前为: ${file.contentType}`
      }
    }

    // 获取上传令牌
    const apiResult = await getOssAvatarUploadToken(file.fileName)
    if (!apiResult.isSuccess || !apiResult.data) {
      return {
        ...apiResult,
        data: undefined,
        msg: apiResult.msg || '获取头像上传令牌失败'
      }
    }

    const token: StsToken = apiResult.data
    const client = createOssClient(token)
    const objectPath = getObjectPath(token.returnPath)
    const newFileName = path.basename(objectPath)

    // 处理头像内容
    let uploadContent: Buffer

    if (file.contentType === 'Base64' && typeof file.content === 'string') {
      uploadContent = Buffer.from(file.content, 'base64')
    } else if (file.contentType === 'Buffer' && file.content instanceof Buffer) {
      uploadContent = file.content
    } else {
      return {
        isSuccess: false,
        errType: 'business',
        msg: `头像内容与contentType不匹配: ${file.contentType}`
      }
    }

    // 执行上传
    await client.put(objectPath, uploadContent)

    // 返回更新后的头像信息
    return {
      isSuccess: true,
      data: {
        ...file,
        fileName: newFileName
      }
    }
  } catch (error) {
    console.error('头像上传失败:', error)
    return {
      isSuccess: false,
      errType: 'business',
      msg: `头像上传失败: ${error instanceof Error ? error.message : String(error)}`
    }
  }
}

/**
 * 从阿里云OSS下载头像
 * @param fileName 头像文件名
 * @param contentType 期望的内容类型
 * @returns 包含下载结果的ApiResult
 */
export async function ossDownloadAvatar(
  fileName: string,
  contentType: null | 'Base64' | 'Buffer'
): Promise<ApiResult<UniversalFile>> {
  try {
    // 检查并刷新令牌
    if (checkExpire(downloadStsAvatarToken)) {
      const apiResult = await getOssAvatarDownloadToken()
      if (!apiResult.isSuccess || !apiResult.data) {
        return { ...apiResult, data: undefined }
      }
      downloadStsAvatarToken = apiResult.data
    }

    // 创建客户端并构建路径
    const client = createOssClient(downloadStsAvatarToken)
    const basePath = getObjectPath(downloadStsAvatarToken.returnPath)
    const objectPath = basePath.endsWith('/') ? `${basePath}${fileName}` : `${basePath}/${fileName}`

    // 下载头像
    const { content, res }: GetObjectResult = await client.get(objectPath)
    if (res.status !== 200) {
      return {
        isSuccess: false,
        msg: `OSS获取头像失败，状态码: ${res.status}`,
        errType: 'business'
      }
    }

    // 不读取内容的情况
    if (contentType === null) {
      return {
        isSuccess: true,
        data: {
          fileName,
          mimeType: getMIMEFromFilename(fileName),
          fileSize: content.length,
          content: undefined,
          contentType: null,
          fileId: objectPath
        }
      }
    }

    // 处理不同类型的返回内容
    let avatarContent: string | Buffer

    switch (contentType) {
      case 'Base64':
        avatarContent = content.toString('base64')
        break
      case 'Buffer':
        avatarContent = content
        break
      default:
        return {
          isSuccess: false,
          errType: 'business',
          msg: `不支持的contentType: ${contentType}`
        }
    }

    return {
      isSuccess: true,
      data: {
        fileName,
        mimeType: getMIMEFromFilename(fileName),
        fileSize: content.length,
        content: avatarContent,
        contentType,
        fileId: objectPath
      }
    }
  } catch (error) {
    console.error('头像下载失败:', error)
    return {
      isSuccess: false,
      msg: `头像下载失败: ${error instanceof Error ? error.message : String(error)}`,
      errType: 'business'
    }
  }
}
