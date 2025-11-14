import { chatSessionDB } from '../../db-manage/db_chatSession'
import Protocol from '../protocol'
import {
  ChatMessage,
  FileMap,
  FileMapStatus,
  MessageStatus,
  MessageType,
  User
} from '@shared/types'
import { notifyWindows } from '../../index'
import { fileMapDB } from '@main/db-manage/db_fileMap'
import { getMIMEFromFilename } from '@shared/utils'
import { waitingAckContainer } from './ackSchedule'
import { clientDataStore } from '@main/clientDataStore'
import { userFriendDB } from '@main/db-manage/db_friends'
import { groupDB } from '@main/db-manage/db_group'
import localFileManager from '@main/file-manage/localFileApi'

export const handleMessageReceive = async (protocol: Protocol): Promise<void> => {
  const message = protocol2message(protocol)
  // 添加消息到数据库
  await chatSessionDB.addOrUpdateMessage(message)
  if (
    message.type === MessageType.IMAGE ||
    message.type === MessageType.VIDEO ||
    message.type === MessageType.OTHER_FILE
  ) {
    await saveFileMessage(message)
  }
  notifyWindows('message-receive', message)
  notifyWindows('update', 'chat_session')
}

export const handleMessageAck = async (protocol: Protocol): Promise<void> => {
  const message = protocol2message(protocol)
  const waitingKey = protocol.sessionId + ':' + protocol.identityId
  const oldMsg = waitingAckContainer.remove(waitingKey)
  if (oldMsg === null) return // 消息已经超时，并执行了失败回调
  if (protocol.getContentType() === Protocol.CONTENT_FAILED) {
    // 服务端返回失败
    notifyWindows('message-ack-error', message)
  } else {
    // 服务端返回成功应答
    oldMsg.messageId = message.messageId
    oldMsg.createdAt = message.createdAt
    oldMsg.updatedAt = message.updatedAt
    oldMsg.status = message.status
    await chatSessionDB.addOrUpdateMessage(oldMsg)
    if (
      message.type === MessageType.IMAGE ||
      message.type === MessageType.VIDEO ||
      message.type === MessageType.OTHER_FILE
    ) {
      await saveFileMessage(oldMsg)
    }
    notifyWindows('message-ack-success', oldMsg)
  }
  // todo: 更新会话的最新消息显示，有待优化，不需要更新所有会话
  notifyWindows('update', 'chat_session')
}

export const saveFileMessage = async (message: ChatMessage): Promise<void> => {
  const [originName, fingerprint, size] = message.content.split(':')
  const remoteName = fingerprint + originName.substring(originName.lastIndexOf('.'))
  const isExist = await localFileManager.userFileExists(remoteName)
  // 消息已经存在，且文件是同步状态
  const newFile: FileMap = {
    originName: originName as string,
    remoteName: remoteName as string,
    fingerprint: fingerprint,
    size: Number.parseInt(size as string),
    mimeType: getMIMEFromFilename(originName as string),
    location: ' ',
    status: isExist ? FileMapStatus.SYNCED : FileMapStatus.WAIT_DOWNLOAD,
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
    sourceType: 0,
    sessionId: message.sessionId,
    sourceInfo: ' '
  }
  // todo: 默认头像问题
  let sourceInfo = ''
  const session = await chatSessionDB.getSessionById(message.sessionId)
  if (session && session.type) {
    const user = clientDataStore.get('user') as User
    if (session.type === 1) {
      // 单聊
      const targetId = session.firstId == user.id ? session.secondId : session.firstId
      const targetUser = await userFriendDB.getFriendRelationsByUserIdAndTargetId(
        user.id,
        targetId as string
      )
      if (message.fromId === user.id) {
        // 用户发送的文件
        sourceInfo = `您发送给 “${targetUser?.remark}”`
      } else {
        sourceInfo = `“${targetUser?.remark}” 发送给您`
      }
    } else {
      // 群聊
      const group = await groupDB.getGroupById(session.firstId as string)
      if (message.fromId === user.id) {
        // 用户发送的文件
        sourceInfo = `您发送给 群聊“${group?.name}”`
      } else {
        sourceInfo = `群聊“${group?.name}” 发送给您`
      }
    }
  }
  newFile.sourceInfo = sourceInfo
  await fileMapDB.addOrUpdateBySessionAndFingerprint(newFile)
}

const protocol2message = (protocol: Protocol): ChatMessage => {
  return {
    sessionId: protocol.sessionId.toString(),
    messageId: protocol.messageId.toString(),
    identityId: protocol.identityId.toString(),
    type: protocol.getContentType(),
    fromId: protocol.fromId.toString(),
    content: protocol.getContentString(),
    status: MessageStatus.TYPE_SUCCESS,
    createdAt: Number(protocol.timeStamp),
    updatedAt: Number(protocol.timeStamp)
  } as ChatMessage
}
