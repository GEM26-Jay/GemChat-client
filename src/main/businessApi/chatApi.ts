import { clientDataStore } from '../clientDataStore'
import { chatSessionDB } from '../db-manage/db_chatSession'
import {
  ApiResult,
  ChatMessage,
  ChatSession,
  ChatGroup,
  GroupMember,
  User,
  MessageStatus,
  UniversalFile,
  MessageType,
  FileProgressEvent,
  FileErrorEvent,
  FileMapStatus,
  FileMap
} from '@shared/types'
import { ipcMain, IpcMainInvokeEvent } from 'electron'
import { groupDB } from '../db-manage/db_group'
import { CreateGroupDTO } from '@shared/DTO.types'
import { postGroupAdd } from '../axios/axiosChatApi'
import { nettyClientManager } from '../tcp-client/client'
import Protocol from '../tcp-client/protocol'
import { downloadFileFromOss, saveFileToLocal, sendFileToOss } from '@main/file-manage/fileManage'
import { generateUUID } from '@shared/utils'
import { waitingAckContainer } from '@main/tcp-client/handlers/ackSchedule'
import { notifyWindows } from '..'
import { generateFileThumbnail, generateVideoThumbnail } from '@main/file-manage/fileUtils'
import { fileMapDB } from '@main/db-manage/db_fileMap'

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
    async (_event: IpcMainInvokeEvent, sessionId: string): Promise<ApiResult<ChatSession>> => {
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
      _event: IpcMainInvokeEvent,
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
      _event: IpcMainInvokeEvent,
      sessionId: string,
      maxTimestamp: number,
      size: number
    ): Promise<ApiResult<ChatMessage[]>> => {
      const result = await chatSessionDB.getMessagesBySessionIdUsingCursor(
        sessionId,
        maxTimestamp,
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
      _event: IpcMainInvokeEvent,
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
  // chat-sendText
  ipcMain.handle(
    'chat-sendText',
    async (
      _event: IpcMainInvokeEvent,
      sessionId: string,
      content: string
    ): Promise<ApiResult<ChatMessage>> => {
      const user = clientDataStore.get('user') as User
      const time = Date.now()
      const identityId = generateUUID()
      const tempMessage: ChatMessage = {
        sessionId,
        fromId: user.id,
        messageId: '0',
        identityId: identityId,
        type: MessageType.TEXT,
        content,
        status: MessageStatus.TYPE_SENDING,
        createdAt: time,
        updatedAt: time
      }
      notifyWindows('message-send', tempMessage)
      const waitingKey = tempMessage.sessionId + ':' + tempMessage.identityId
      waitingAckContainer.set(waitingKey, tempMessage, 30000, () => {
        tempMessage.status = MessageStatus.TYPE_FAILED
        notifyWindows('message-ack-error', tempMessage)
      })
      try {
        const protocol = new Protocol()
        protocol.fromId = BigInt(user.id)
        protocol.sessionId = BigInt(sessionId)
        protocol.identityId = BigInt(identityId)
        protocol.type = Protocol.ORDER_MESSAGE + Protocol.CONTENT_TEXT
        protocol.setContent(content)
        protocol.timeStamp = BigInt(time)
        const success = nettyClientManager.sendProtocol(protocol)
        if (success) {
          return {
            isSuccess: true,
            data: tempMessage
          }
        } else {
          tempMessage['status'] = MessageStatus.TYPE_FAILED
          notifyWindows('message-ack-error', tempMessage)
          return {
            isSuccess: false,
            msg: `[IPC: chat-sendMessage]: 发送消息失败`,
            data: tempMessage
          }
        }
      } catch (err) {
        tempMessage['status'] = MessageStatus.TYPE_FAILED
        notifyWindows('message-ack-error', tempMessage)
        return { isSuccess: false, msg: `[IPC: chat-sendMessage]: ${err}`, data: tempMessage }
      }
    }
  )

  // chat-sendFile
  ipcMain.handle(
    'chat-sendFile',
    async (
      _event: IpcMainInvokeEvent,
      sessionId: string,
      file: UniversalFile
    ): Promise<ApiResult<ChatMessage>> => {
      const user = clientDataStore.get('user') as User
      const time = Date.now()
      const remoteName = file.fingerprint + file.fileName.slice(file.fileName.lastIndexOf('.'))
      // 保存文件到本地
      const localApi = await saveFileToLocal(file)
      if (!localApi.isSuccess || !localApi.data) throw new Error('消息保存本地失败')

      const oldMap = await fileMapDB.getBySessionAndFingerprint(
        sessionId,
        file.fingerprint as string
      )
      if (!oldMap || oldMap.status != FileMapStatus.SYNCED) {
        // 存储数据库
        const fileMap: FileMap = {
          originName: file.fileName,
          remoteName: remoteName,
          fingerprint: file.fingerprint as string,
          size: file.fileSize,
          mimeType: file.mimeType,
          location: file.localPath ? file.localPath : ' ',
          status: FileMapStatus.WAIT_UPLOAD,
          createdAt: time,
          updatedAt: time,
          sourceType: 0,
          sessionId: sessionId,
          sourceInfo: ' '
        }
        await fileMapDB.addOrUpdateBySessionAndFingerprint(fileMap)
      }

      // 发送消息（虚假）
      const tempMessage: ChatMessage = {
        fromId: user.id,
        sessionId,
        identityId: generateUUID(),
        messageId: '0',
        type: MessageType.OTHER_FILE,
        content:
          file.fileName.replace(':', '') + ':' + file.fingerprint + ':' + file.fileSize + ':',
        status: MessageStatus.TYPE_SENDING,
        createdAt: time,
        updatedAt: time
      }
      if (file.mimeType.startsWith('image')) {
        tempMessage.type = MessageType.IMAGE
        const thumbnail = await generateFileThumbnail(file.localPath as string, 'Base64', 200)
        tempMessage.content = tempMessage.content + thumbnail.content
      } else if (file.mimeType.startsWith('video')) {
        tempMessage.type = MessageType.VIDEO
        const thumbnail = await generateVideoThumbnail(file.localPath as string, 'Base64', 200)
        tempMessage.content =
          tempMessage.content + (thumbnail ? (thumbnail?.content as string) : ' ')
      }
      notifyWindows('message-send', tempMessage)

      const onProgress = async (value: number): Promise<void> => {
        if (value >= 100) {
          // 注册消息到等待队列
          const waitingKey = tempMessage.sessionId + ':' + tempMessage.identityId
          waitingAckContainer.set(waitingKey, tempMessage, 30000, () => {
            tempMessage.status = MessageStatus.TYPE_FAILED
            notifyWindows('message-ack-error', tempMessage)
          })
          // 发送消息到服务器
          const protocol = new Protocol()
          protocol.fromId = BigInt(tempMessage.fromId)
          protocol.sessionId = BigInt(sessionId)
          protocol.identityId = BigInt(tempMessage.identityId as string)
          protocol.type = Protocol.ORDER_MESSAGE + tempMessage.type
          protocol.setContent(tempMessage.content)
          protocol.timeStamp = BigInt(tempMessage.createdAt)
          nettyClientManager.sendProtocol(protocol)
        }
        // 给渲染进程通知进度
        notifyWindows('file-ops-progress', {
          taskId: file.fingerprint,
          progress: value,
          type: 'upload',
          fileName: file.fileName
        } as FileProgressEvent)
      }
      const onError = async (): Promise<void> => {
        const waitingKey = tempMessage.sessionId + ':' + tempMessage.identityId
        waitingAckContainer.delete(waitingKey)
        tempMessage.status = MessageStatus.TYPE_FAILED
        notifyWindows('message-ack-error', tempMessage)
        // 给渲染进程通知进度
        notifyWindows('file-ops-error', {
          taskId: file.fingerprint,
          type: 'upload',
          fileName: file.fileName
        } as FileErrorEvent)
      }

      sendFileToOss(localApi.data.fileName, 0, onProgress, onError, sessionId)
      return {
        isSuccess: true,
        data: tempMessage
      }
    }
  )

  // chat-download
  ipcMain.handle(
    'chat-download',
    async (_event: IpcMainInvokeEvent, fileName: string): Promise<ApiResult<void>> => {
      const fingerprint = fileName.slice(0, fileName.lastIndexOf('.'))

      const onProgress = async (value: number): Promise<void> => {
        if (value >= 100) {
          fileMapDB.updateStatusByFingerprint(FileMapStatus.SYNCED, fingerprint)
        }
        // 给渲染进程通知进度
        notifyWindows('file-ops-progress', {
          taskId: fingerprint,
          progress: value,
          type: 'download',
          fileName: fileName
        } as FileProgressEvent)
      }
      const onError = async (): Promise<void> => {
        notifyWindows('file-ops-error', {
          taskId: fingerprint,
          type: 'download',
          fileName: fileName
        } as FileProgressEvent)
      }
      downloadFileFromOss(fileName, onProgress, onError)
      return {
        isSuccess: true
      }
    }
  )
}
