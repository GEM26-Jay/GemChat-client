import { ApiResult, StsToken } from '@shared/types'
import { axiosClient } from './axiosClient'

/**
 * 获取文件上传Token
 */
export async function getOssUploadToken(fileName: string): Promise<ApiResult<StsToken>> {
  // 调用登录接口（直接获取ApiResult）
  const result = await axiosClient.get<ApiResult<StsToken>>('/api/sts/upload', {
    params: {
      fileName: fileName
    }
  })

  const apiResult = result.data

  return apiResult
}

/**
 * 获取文件下载Token
 */
export async function getOssdownloadToken(): Promise<ApiResult<StsToken>> {
  const result = await axiosClient.post<ApiResult<StsToken>>('/api/sts/download')

  const apiResult = result.data

  return apiResult
}

/**
 * 获取头像文件上传Token
 */
export async function getOssAvatarUploadToken(fileName: string): Promise<ApiResult<StsToken>> {
  const result = await axiosClient.get<ApiResult<StsToken>>('/api/sts/uploadAvatar', {
    params: {
      fileName: fileName
    }
  })
  const apiResult = result.data

  return apiResult
}

/**
 * 获取头像文件下载Token
 */
export async function getOssAvatarDownloadToken(): Promise<ApiResult<StsToken>> {
  // 调用登录接口（直接获取ApiResult）
  const result = await axiosClient.get<ApiResult<StsToken>>('/api/sts/downloadAvatar')

  const apiResult = result.data

  return apiResult
}
