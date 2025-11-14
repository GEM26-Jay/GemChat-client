import { ApiResult, FileToken } from '@shared/types'
import { axiosClient } from './axiosClient'
import { FileUploadDTO } from '@shared/DTO.types'

/**
 * 获取文件上传Token
 */
export async function postOssFileUploadToken(dto: FileUploadDTO): Promise<ApiResult<FileToken>> {
  // 调用登录接口（直接获取ApiResult）
  const result = await axiosClient.post<ApiResult<FileToken>>('/api/file/upload', dto)
  const apiResult = result.data
  return apiResult
}

/**
 * 获取文件下载Token
 */
export async function getOssFileDownloadToken(fileName: string): Promise<ApiResult<FileToken>> {
  const result = await axiosClient.get<ApiResult<FileToken>>('/api/file/download', {
    params: {
      fileName
    }
  })
  const apiResult = result.data
  return apiResult
}

/**
 * 文件上传成功回调
 */
export async function putOssFileSuccessUpload(fileName: string): Promise<ApiResult<void>> {
  const result = await axiosClient.put<ApiResult<void>>('/api/file/successUpload', null, {
    params: {
      fileName
    }
  })
  return result.data
}

/**
 * 文件上传失败回调
 */
export async function putOssFileFailUpload(fileName: string): Promise<ApiResult<void>> {
  const result = await axiosClient.put<ApiResult<void>>('/api/file/failUpload', null, {
    params: {
      fileName
    }
  })
  return result.data
}

/**
 * 获取头像文件上传Token
 */
export async function postOssAvatarUploadToken(dto: FileUploadDTO): Promise<ApiResult<FileToken>> {
  const result = await axiosClient.post<ApiResult<FileToken>>('/api/avatar/upload', dto)
  const apiResult = result.data
  return apiResult
}

/**
 * 获取头像文件下载Token
 */
export async function getOssAvatarDownloadToken(fileName: string): Promise<ApiResult<FileToken>> {
  // 调用登录接口（直接获取ApiResult）
  const result = await axiosClient.get<ApiResult<FileToken>>('/api/avatar/download', {
    params: {
      fileName
    }
  })
  const apiResult = result.data
  return apiResult
}
