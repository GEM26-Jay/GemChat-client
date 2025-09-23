import { ApiResult, FileToken } from '@shared/types'
import { axiosClient } from './axiosClient'
import { FileUploadDTO } from '@shared/DTO.types'

/**
 * 获取文件上传Token
 */
export async function getOssUploadToken(dto: FileUploadDTO): Promise<ApiResult<FileToken>> {
  // 调用登录接口（直接获取ApiResult）
  const result = await axiosClient.post<ApiResult<FileToken>>('/api/file/upload', dto)
  const apiResult = result.data
  return apiResult
}

/**
 * 获取文件下载Token
 */
export async function getOssdownloadToken(fileName: string): Promise<ApiResult<FileToken>> {
  const result = await axiosClient.get<ApiResult<FileToken>>('/api/file/download', {
    params: {
      fileName
    }
  })
  const apiResult = result.data
  return apiResult
}

/**
 * 获取头像文件上传Token
 */
export async function getOssAvatarUploadToken(dto: FileUploadDTO): Promise<ApiResult<FileToken>> {
  const result = await axiosClient.post<ApiResult<FileToken>>('/api/file/uploadAvatar', dto)
  const apiResult = result.data
  return apiResult
}

/**
 * 获取头像文件下载Token
 */
export async function getOssAvatarDownloadToken(fileName: string): Promise<ApiResult<FileToken>> {
  // 调用登录接口（直接获取ApiResult）
  const result = await axiosClient.get<ApiResult<FileToken>>('/api/file/downloadAvatar', {
    params: {
      fileName
    }
  })
  const apiResult = result.data
  return apiResult
}

export async function insertOSSDb(dto: FileUploadDTO): Promise<ApiResult<void>> {
  const result = await axiosClient.post<ApiResult<void>>('/api/file/insertDB', dto)
  const apiResult = result.data
  return apiResult
}
