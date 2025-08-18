import { userDB } from '../db-manage/db_user'
import { postUserRegister, getUserInfo, postUserLogin, getSearchUser } from '../axios/axiosUserApi'
import { clientDataStore } from '../clientDataStore'
import { initializeLocalStorage } from '../file-manage/localFileApi'
import { ApiResult, RegisterData, User } from '@shared/types'
import { ipcMain, IpcMainInvokeEvent } from 'electron'

/**
 * 用户登录（基于ApiResult处理业务逻辑）
 */
export async function doUserLogin(account: string, password: string): Promise<ApiResult<User>> {
  const loginResult: ApiResult<string> = await postUserLogin(account, password)

  if (loginResult.isSuccess) {
    // 获取用户基本信息
    const result: ApiResult<User> = await getUserInfo(null)
    if (result.isSuccess) {
      const user = result.data
      clientDataStore.set('user', user)
      // 初始化本地存储空间
      initializeLocalStorage()
      return {
        isSuccess: true,
        data: user
      }
    } else {
      return {
        isSuccess: false,
        msg: '获取用户信息失败'
      }
    }
  } else {
    return {
      isSuccess: false,
      msg: '登录失败'
    }
  }
}

/**
 * 用户注册
 */
export async function doUserRegister(data: RegisterData): Promise<ApiResult> {
  const apiResult = await postUserRegister(data)
  return apiResult
}

/**
 * 注册IPC处理器
 */
export function registerUserApiIpcHandlers(): void {
  ipcMain.handle(
    'doUserLogin',
    async (_event: IpcMainInvokeEvent, account: string, password: string) => {
      return await doUserLogin(account, password)
    }
  )

  ipcMain.handle('doUserRegister', async (_event: IpcMainInvokeEvent, data: RegisterData) => {
    return await doUserRegister(data)
  })

  ipcMain.handle('getUserInfo', async (_event: IpcMainInvokeEvent, id: string | null) => {
    return await getUserInfo(id)
  })

  ipcMain.handle('searchUserBlur', async (_event: IpcMainInvokeEvent, keyword: string) => {
    return await getSearchUser(keyword)
  })

  ipcMain.handle('user-selectById', async (_event: IpcMainInvokeEvent, id: string) => {
    const user = await userDB.getById(id)
    if (!user) {
      console.log(`本地数据库查询User失败: id=${id}`)
      const apiResult = await getUserInfo(id)
      if (apiResult.isSuccess && apiResult.data) {
        userDB.addOrUpdate(apiResult.data)
        console.log(`服务器数据库查询User成功: id=${id}, 已添加数据`)
      } else {
        console.log(`服务器数据库查询User失败: id=${id}`)
      }
      return apiResult
    } else {
      return { isSuccess: true, data: user } as ApiResult<User>
    }
  })
}
