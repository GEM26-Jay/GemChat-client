import { userDB } from '../db-manage/db_user'
import { postUserRegister, getUserInfo, postUserLogin, getSearchUser } from '../axios/axiosUserApi'
import { clientDataStore } from '../clientDataStore'
import { ApiResult, RegisterData, User } from '@shared/types'
import { ipcMain, IpcMainInvokeEvent } from 'electron'
import { registerNettyClient as registerNettyClientAndHandler } from '../tcp-client/handler'
import { HandleAllSync } from '@main/tcp-client/handlers/syncHandler'
import { dbManager } from '@main/db-manage/database'
import { localFileManager } from '@main/file-manage/localFileApi'

/**
 * 用户登录（基于ApiResult处理业务逻辑）
 */
export async function doUserLogin(account: string, password: string): Promise<ApiResult<User>> {
  const loginResult: ApiResult<string> = await postUserLogin(account, password)
  // const mock_loginResult: ApiResult<string> = { isSuccess: true }

  if (loginResult.isSuccess) {
    // 获取用户基本信息
    const result: ApiResult<User> = await getUserInfo(null)
    // const mock_result: ApiResult<User> = {
    //   isSuccess: true,
    //   data: {
    //     id: '356285032555347968',
    //     username: 'admin',
    //     maskedEmail: '1111',
    //     maskedPhone: 'string',
    //     avatar: 'default_avatar.png',
    //     signature: 'string',
    //     gender: 0,
    //     birthdate: 'string',
    //     status: 1,
    //     createdAt: 12345678,
    //     updatedAt: 12345678
    //   }
    // }
    if (result.isSuccess && result.data) {
      const user = result.data
      clientDataStore.set('user', user)
      // 切换数据库到用户独立数据库
      await dbManager.setPrivateDb(user.id)
      // 初始化本地存储空间
      localFileManager.initialize(user.id)
      // 初始化TCP连接
      registerNettyClientAndHandler()
      // 同步所有历史消息
      HandleAllSync()
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
