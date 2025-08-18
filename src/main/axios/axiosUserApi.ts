import { dialog } from 'electron'
import { axiosClient, tokenManager } from './axiosClient'
import { ApiResult, RegisterData, User } from '@shared/types'
import { closeMainWindow, openLoginWindow } from '../index'
import { DeviceHashManager } from '../deviceHashManager'
import os from 'os'

// 存储刷新定时器ID
let refreshTimer: NodeJS.Timeout | null = null

/**
 * 用户登录（基于ApiResult处理业务逻辑）
 */
export async function postUserLogin(account: string, password: string): Promise<ApiResult<string>> {
  // 清除旧定时器
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }

  const deviceId: string = await DeviceHashManager.getInstance().getDeviceHash()

  // 调用登录接口（直接获取ApiResult）
  const result = await axiosClient.post<ApiResult<string>>('/api/user/login', {
    account: account,
    password: password,
    platform: os.platform(),
    deviceHash: deviceId
  })

  const apiResult = result.data

  if (apiResult.isSuccess && apiResult.data !== undefined) {
    // 登录成功：保存Token和用户信息
    tokenManager.setToken(apiResult.data)
    // 启动Token自动刷新
    startTokenRefresh(account, password)
  }
  return apiResult
}

/**
 * 启动Token自动刷新
 */
function startTokenRefresh(account: string, password: string): void {
  const REFRESH_INTERVAL = 24 * 60 * 60 * 1000 // 24小时
  // const REFRESH_INTERVAL = 60 * 1000 // 测试：1分钟

  refreshTimer = setInterval(async () => {
    console.log('开始自动刷新Token...')
    const result = await axiosClient.post<ApiResult<string>>('/api/user/login', {
      account,
      password
    })

    const apiResult = result.data
    // 检查刷新结果
    if (apiResult.isSuccess && apiResult.data !== undefined) {
      tokenManager.setToken(apiResult.data)
      console.log('Token刷新成功')
    } else {
      console.error('Token刷新失败:', apiResult.msg !== undefined ? apiResult.msg : '')
      handleRefreshFailure()
      return
    }
  }, REFRESH_INTERVAL)
}

/**
 * 处理刷新失败
 */
function handleRefreshFailure(): void {
  dialog.showMessageBox({
    type: 'warning',
    title: '登录状态失效',
    message: '登录已过期，请重新登录',
    buttons: ['确定']
  })

  // 清理资源并跳转登录
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
  closeMainWindow()
  openLoginWindow()
}

/**
 * 用户注册
 */
export async function postUserRegister(data: RegisterData): Promise<ApiResult> {
  // 调用注册接口（直接获取ApiResult）
  const result = await axiosClient.post<ApiResult<void>>('/api/user/register', data)
  const apiResult = result.data
  return apiResult
}

/**
 * 获取用户信息
 */
export async function getUserInfo(userId: string | null): Promise<ApiResult<User>> {
  // 简洁处理参数：userId为null时不传该参数，否则传递userId
  const response = await axiosClient.get<ApiResult<User>>('/api/user/info', {
    params: userId ? { userId } : undefined
  })

  // 直接返回响应数据（已被拦截器处理为ApiResult格式）
  return response.data
}

/**
 * 批量获取用户信息
 */
export async function postUserInfoBatch(userIds: string[]): Promise<ApiResult<User[]>> {
  // POST请求通过data传递ID列表，放在请求体中
  const response = await axiosClient.post<ApiResult<User[]>>('/api/user/infoBatch', {
    userIds: userIds // 请求体中直接传递数组
  })

  return response.data
}

/**
 * 根据用户信息搜索用户
 */
export async function getSearchUser(keyword: string): Promise<ApiResult<User[]>> {
  // POST请求通过data传递ID列表，放在请求体中
  const response = await axiosClient.get<ApiResult<User[]>>('/api/user/search', {
    params: { keyword } // 请求体中直接传递数组
  })

  return response.data
}
