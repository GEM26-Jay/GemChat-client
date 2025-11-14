import { ApiResult } from '@shared/types'
import axios, { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios'

// 全局Token存储
let token: string = ''

/** Token管理工具 */
export const tokenManager = {
  setToken: (newToken: string) => {
    token = newToken
  },
  getToken: () => token,
  clearToken: () => {
    token = ''
  }
}

/** 后端原始响应格式 */
export interface RawResponse<T = void> {
  code: number
  msg: string
  data: T
}

// 创建Axios实例
export const axiosClient = axios.create({
  // baseURL: 'http://192.168.137.1:8888/',
  baseURL: 'http://localhost:8888/',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// 请求拦截器：注入Token + 错误包装
axiosClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
    const currentToken = tokenManager.getToken()
    if (currentToken && config.url?.startsWith('/api')) {
      config.headers.Authorization = `Bearer ${currentToken}`
    }
    console.log(
      `[axiosClient]: 发起远程请求: ${config.url}}, 携带数据: ${JSON.stringify(config.params)}、${JSON.stringify(config.data)}`
    )
    return config
  },
  (error: AxiosError): AxiosResponse<ApiResult> => {
    // 请求配置错误：返回标准AxiosResponse格式，data为ApiResult
    return {
      data: {
        isSuccess: false,
        msg: error.message || '请求配置错误',
        errType: 'http'
      },
      status: 400, // 请求错误默认状态码
      statusText: 'Bad Request',
      headers: error.response?.headers || {},
      config: error.config as InternalAxiosRequestConfig
    }
  }
)

// 响应拦截器：统一包装ApiResult到data中
axiosClient.interceptors.response.use(
  (response: AxiosResponse<RawResponse>): AxiosResponse<ApiResult> => {
    console.log(
      `[axiosClient]: 请求: ${response.config.url}, 返回结果: ${JSON.stringify(response.data)}`
    )
    // 成功响应：后端RawResponse转换为ApiResult
    return {
      ...response,
      data: {
        isSuccess: response.data.code === 200,
        data: response.data.data,
        msg: response.data.msg,
        errType: response.data.code !== 200 ? 'business' : undefined
      }
    }
  },
  (error: AxiosError): AxiosResponse<ApiResult> => {
    console.log(`远程请求: ${error.config?.url}, 请求错误: ${JSON.stringify(error.cause)}`)
    // 错误响应：HTTP错误/网络错误转换为ApiResult
    let errorMsg = '未知错误'
    let status = 500 // 默认服务器错误状态码

    if (error.response) {
      // 有响应但状态码异常（4xx/5xx）
      status = error.response.status
      if (status === 401) {
        tokenManager.clearToken() // Token失效处理
      }
      errorMsg = (error.response.data as RawResponse)?.msg || `HTTP错误: ${status}`
    } else if (error.request) {
      // 无响应（网络错误）
      status = 0 // 网络错误用0标记
      errorMsg = '网络异常，服务器未响应'
    } else {
      // 其他错误（如请求配置错误）
      status = 400
      errorMsg = error.message || '请求失败'
    }

    // 返回标准AxiosResponse格式，data为ApiResult
    return {
      data: {
        isSuccess: false,
        msg: errorMsg,
        errType: 'http'
      },
      status,
      statusText: error.response?.statusText || 'Error',
      headers: error.response?.headers || {},
      config: error.config as InternalAxiosRequestConfig
    }
  }
)
