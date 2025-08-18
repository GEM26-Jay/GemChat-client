import { notifyWindows } from '..'
import {
  postFriendRequestApply,
  postFriendRequestUpdate,
  postUserFriendUpdateBlock,
  postUserFriendUpdateDelete,
  postUserFriendUpdateRemark
} from '../axios/axiosFriendApi'
import { clientDataStore } from '../clientDataStore'
import { friendRequestDB } from '../db-manage/db_friendRequest'
import { userFriendDB } from '../db-manage/db_friends'
import { ApiResult, FriendRequest, User, UserFriend } from '@shared/types'
import { ipcMain, IpcMainInvokeEvent } from 'electron'

/**
 * 注册IPC处理器
 */
export function registerFriendApiIpcHandlers(): void {
  // friend-getRequests
  ipcMain.handle('friend-getRequests', async (): Promise<ApiResult<FriendRequest[]>> => {
    try {
      const user = (await clientDataStore.get('user')) as User
      const data = await friendRequestDB.getRelatedRequestsByUserId(user.id)
      return {
        isSuccess: true,
        data: data
      }
    } catch (err) {
      console.log(`[IPC: getFriendRequests]: ${err}`)
      return {
        isSuccess: false,
        msg: `[IPC: getFriendRequests]: ${err}`
      }
    }
  })
  // friend-updateRequest
  ipcMain.handle(
    'friend-updateRequest',
    async (
      _event: IpcMainInvokeEvent,
      request: FriendRequest
    ): Promise<ApiResult<FriendRequest>> => {
      try {
        const user = clientDataStore.get('user') as User
        if (user.id !== request.toId) {
          return {
            isSuccess: false,
            msg: `[IPC: updateFriendRequest]: 用户不能修改该状态`
          }
        }
        const apiResult = await postFriendRequestUpdate(request)
        if (apiResult.isSuccess) {
          const newData = apiResult.data
          const dbResult = await friendRequestDB.upsertRequest(newData as FriendRequest)
          if (dbResult) {
            notifyWindows('update', 'friend_request')
            return {
              isSuccess: true,
              data: newData
            }
          } else {
            return {
              isSuccess: false,
              msg: `本地数据库更新失败`
            }
          }
        } else {
          return {
            isSuccess: false,
            msg: `服务器上传失败: ${apiResult.msg}`
          }
        }
      } catch (err) {
        console.log(`[IPC: updateFriendRequest]: ${err}`)
        return {
          isSuccess: false,
          msg: `[IPC: getRequests]: ${err}`
        }
      }
    }
  )
  // friend-addRequest
  ipcMain.handle(
    'friend-addRequest',
    async (
      _event: IpcMainInvokeEvent,
      request: FriendRequest
    ): Promise<ApiResult<FriendRequest>> => {
      try {
        const user = clientDataStore.get('user') as User
        if (user.id !== request.fromId) {
          return {
            isSuccess: false,
            msg: `用户没有权限`
          }
        }
        if (request.toId === request.fromId) {
          return {
            isSuccess: false,
            msg: `不能添加自己`
          }
        }
        const isAlreadyFriend: UserFriend = await userFriendDB.getByIds(user.id, request.toId)
        if (isAlreadyFriend && isAlreadyFriend.deleteStatus == 0) {
          return {
            isSuccess: false,
            msg: '对方已是你的好友，不能重复添加'
          }
        }

        const b1 = await friendRequestDB.checkDuplicateRequest(request.fromId, request.toId)
        const b2 = await friendRequestDB.checkDuplicateRequest(request.toId, request.fromId)
        if (b1 || b2) {
          return {
            isSuccess: false,
            msg: `好友申请已经存在`
          }
        }
        const apiResult = await postFriendRequestApply(request)
        if (apiResult.isSuccess) {
          const newData = apiResult.data
          await friendRequestDB.addRequest(newData as FriendRequest)
          notifyWindows('update', 'friend_request')
          return {
            isSuccess: true,
            data: newData
          }
        } else {
          console.log(`[IPC: friend-requestAdd]: 服务器请求失败: ${apiResult.msg}`)
          return {
            isSuccess: false,
            msg: `服务器请求失败: ${apiResult.msg}`
          }
        }
      } catch (err) {
        console.log(`[IPC: friend-requestAdd]: ${err}`)
        return {
          isSuccess: false,
          msg: `[IPC: friend-requestAdd]: ${err}`
        }
      }
    }
  )
  // friend-getValidFriends
  ipcMain.handle('friend-getValidFriends', async (): Promise<ApiResult<UserFriend[]>> => {
    try {
      const result = await userFriendDB.getValidFriends((clientDataStore.get('user') as User).id)
      return {
        isSuccess: true,
        data: result
      }
    } catch (err) {
      console.log(`[IPC: getValidFriends]: ${err}`)
      return {
        isSuccess: false,
        msg: `[IPC: getValidFriends]: ${err}`
      }
    }
  })
  // friend-getBlacklist
  ipcMain.handle('friend-getBlacklist', async (): Promise<ApiResult<UserFriend[]>> => {
    try {
      const result = await userFriendDB.getBlacklist((clientDataStore.get('user') as User).id)
      return {
        isSuccess: true,
        data: result
      }
    } catch (err) {
      console.log(`[IPC: getValidFriends]: ${err}`)
      return {
        isSuccess: false,
        msg: `[IPC: getValidFriends]: ${err}`
      }
    }
  })
  // friend-getById
  ipcMain.handle(
    'friend-getById',
    async (_event: IpcMainInvokeEvent, id: string): Promise<ApiResult<UserFriend>> => {
      try {
        const result = await userFriendDB.getByIds((clientDataStore.get('user') as User).id, id)
        return {
          isSuccess: true,
          data: result
        }
      } catch (err) {
        console.log(`[IPC: getValidFriends]: ${err}`)
        return {
          isSuccess: false,
          msg: `[IPC: getValidFriends]: ${err}`
        }
      }
    }
  )
  // friend-updateFriendRemark
  ipcMain.handle(
    'friend-updateFriendRemark',
    async (_event: IpcMainInvokeEvent, userFriend: UserFriend): Promise<ApiResult<void>> => {
      try {
        const apiResult: ApiResult<UserFriend> = await postUserFriendUpdateRemark(userFriend)
        if (apiResult.isSuccess && apiResult.data) {
          await userFriendDB.upsertFriendRelation(apiResult.data)
          notifyWindows('update', 'user_friend')
          return {
            isSuccess: true
          }
        } else
          return {
            ...apiResult,
            data: undefined
          }
      } catch (err) {
        console.log(`[IPC: updateFriendRemark]: ${err}`)
        return {
          isSuccess: false,
          msg: `[IPC: updateFriendRemark]: ${err}`
        }
      }
    }
  )
  // friend-updateFriendBlock
  ipcMain.handle(
    'friend-updateFriendBlock',
    async (_event: IpcMainInvokeEvent, userFriend: UserFriend): Promise<ApiResult<void>> => {
      try {
        const apiResult: ApiResult<UserFriend[]> = await postUserFriendUpdateBlock(userFriend)
        if (apiResult.isSuccess && apiResult.data) {
          for (const item of apiResult.data) {
            await userFriendDB.upsertFriendRelation(item)
          }
          notifyWindows('update', 'user_friend')
          return {
            isSuccess: true
          }
        } else
          return {
            ...apiResult,
            data: undefined
          }
      } catch (err) {
        console.log(`[IPC: updateFriendBlock]: ${err}`)
        return {
          isSuccess: false,
          msg: `[IPC: updateFriendBlock]: ${err}`
        }
      }
    }
  )
  // friend-updateFriendDelete
  ipcMain.handle(
    'friend-updateFriendDelete',
    async (_event: IpcMainInvokeEvent, userFriend: UserFriend): Promise<ApiResult<void>> => {
      try {
        const apiResult: ApiResult<UserFriend[]> = await postUserFriendUpdateDelete(userFriend)
        if (apiResult.isSuccess && apiResult.data) {
          for (const item of apiResult.data) {
            await userFriendDB.upsertFriendRelation(item)
          }
          notifyWindows('update', 'user_friend')
          return {
            isSuccess: true
          }
        } else
          return {
            ...apiResult,
            data: undefined
          }
      } catch (err) {
        console.log(`[IPC: updateFriendRemark]: ${err}`)
        return {
          isSuccess: false,
          msg: `[IPC: updateFriendRemark]: ${err}`
        }
      }
    }
  )
}
