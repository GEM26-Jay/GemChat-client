import { ApiResult } from '@shared/types'
import { axiosClient } from './axiosClient'

/**
 * 获取netty客户端地址
 */
export async function getNettyServerAddress(): Promise<ApiResult<string>> {
  // 调用登录接口（直接获取ApiResult）
  const result = await axiosClient.get<ApiResult<string>>('/api/netty/getAddr')

  const apiResult = result.data

  return apiResult
}
