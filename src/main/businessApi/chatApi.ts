import { clientDataStore } from '../clientDataStore'
import { chatSessionDB } from '../db-manage/db_chatSession'
import { ApiResult, ChatMessage, ChatSession, ChatGroup, GroupMember, User } from '@shared/types'
import { ipcMain, IpcMainInvokeEvent } from 'electron'
import { groupDB } from '../db-manage/db_group'
import { CreateGroupDTO } from '@shared/DTO.types'
import { postGroupAdd } from '../axios/axiosChatApi'

export function registerChatApiIpcHandlers(): void {
  // chat-getSessions
  ipcMain.handle('chat-getSessions', async (): Promise<ApiResult<ChatSession[]>> => {
    const user = (await clientDataStore.get('user')) as User
    const singleSessions: ChatSession[] = await chatSessionDB.getSingleSessionsByUserId(user.id)
    const groupIds: string[] = await groupDB.getGroupIdsByUserId(user.id)
    const groupSession: ChatSession[] = await chatSessionDB.getGroupSessionsByGroupIds(groupIds)
    // 1. 合并两个数组
    const mergedList = singleSessions.concat(groupSession)

    // 2. 排序
    mergedList.sort((session1, session2) => {
      let time1 = session1.lastMessageTime
      let time2 = session2.lastMessageTime
      if (time1 === null) {
        time1 = session1.createdAt
      }
      if (time2 === null) {
        time2 = session2.createdAt
      }
      return time2 - time1
    })
    return {
      isSuccess: true,
      data: mergedList
    }
  })

  // chat-getGroup
  ipcMain.handle(
    'chat-getGroupById',
    async (_event: IpcMainInvokeEvent, groupId: string): Promise<ApiResult<ChatGroup>> => {
      const data = await groupDB.getGroupById(groupId)
      if (data != null) {
        return {
          isSuccess: true,
          data: data
        }
      } else {
        return {
          isSuccess: false
        }
      }
    }
  )
  // chat-getSessionById
  ipcMain.handle(
    'chat-getSessionById',
    async (event: IpcMainInvokeEvent, sessionId: string): Promise<ApiResult<ChatSession>> => {
      const result = await chatSessionDB.getSessionById(sessionId)
      if (result) {
        return {
          isSuccess: true,
          data: result
        }
      } else {
        return {
          isSuccess: false,
          msg: '未找到数据'
        }
      }
    }
  )
  // chat-getMessagesBySessionId
  ipcMain.handle(
    'chat-getMessagesBySessionId',
    async (
      event: IpcMainInvokeEvent,
      sessionId: string,
      page: number,
      pageSize: number
    ): Promise<ApiResult<ChatMessage[]>> => {
      const result = await chatSessionDB.getMessagesBySessionId(sessionId, page, pageSize)
      if (result) {
        return {
          isSuccess: true,
          data: result
        }
      } else {
        return {
          isSuccess: false,
          msg: '未找到数据'
        }
      }
    }
  )
  // chat-getMessagesBySessionIdUsingCursor
  ipcMain.handle(
    'chat-getMessagesBySessionIdUsingCursor',
    async (
      event: IpcMainInvokeEvent,
      sessionId: string,
      ltMessageId: string,
      size: number
    ): Promise<ApiResult<ChatMessage[]>> => {
      const result = await chatSessionDB.getMessagesBySessionIdUsingCursor(
        sessionId,
        ltMessageId,
        size
      )
      if (result) {
        return {
          isSuccess: true,
          data: result
        }
      } else {
        return {
          isSuccess: false,
          msg: '未找到数据'
        }
      }
    }
  )
  // chat-getGroupMemberByGroupIdAndUserId
  ipcMain.handle(
    'chat-getGroupMemberByGroupIdAndUserId',
    async (
      event: IpcMainInvokeEvent,
      groupId: string,
      userId: string
    ): Promise<ApiResult<GroupMember>> => {
      const result = await groupDB.getGroupMemberByGroupIdAndUserId(groupId, userId)
      if (result) {
        return {
          isSuccess: true,
          data: result
        }
      } else {
        return {
          isSuccess: false,
          msg: '未找到数据'
        }
      }
    }
  )
  // chat-getSingleSessionByUserIds
  ipcMain.handle(
    'chat-getSingleSessionByUserIds',
    async (
      _event: IpcMainInvokeEvent,
      firstId: string,
      secondId: string
    ): Promise<ApiResult<ChatSession>> => {
      const result = await chatSessionDB.getSingleSessionByUserIds(firstId, secondId)
      if (result) {
        return {
          isSuccess: true,
          data: result
        }
      } else {
        return {
          isSuccess: false,
          msg: '未找到数据'
        }
      }
    }
  )
  // getGroupSessionByGroupId
  ipcMain.handle(
    'chat-getGroupSessionByGroupId',
    async (_event: IpcMainInvokeEvent, groupId: string): Promise<ApiResult<ChatSession>> => {
      const result = await chatSessionDB.getGroupSessionByGroupId(groupId)
      if (result) {
        return {
          isSuccess: true,
          data: result
        }
      } else {
        return {
          isSuccess: false,
          msg: '未找到数据'
        }
      }
    }
  )
  // chat-addGroup
  ipcMain.handle(
    'chat-createGroup',
    async (_event: IpcMainInvokeEvent, dto: CreateGroupDTO): Promise<ApiResult<ChatGroup>> => {
      const result = await postGroupAdd(dto)
      if (result.isSuccess && result.data) {
        return result
      } else {
        return {
          isSuccess: false,
          msg: result.msg
        }
      }
    }
  )
}
