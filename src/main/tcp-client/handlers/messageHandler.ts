import { chatSessionDB } from '../../db-manage/db_chatSession'
import Protocol from '../protocol'
import { ChatMessage, FileMap, MessageStatus, User } from '@shared/types'
import { notifyWindows } from '../../index'
import { fileMapDB } from '@main/db-manage/db_fileMap'
import { clientDataStore } from '@main/clientDataStore'
import { getMIMEFromFilename } from '@shared/utils'

export const handleMessageReceive = async (protocol: Protocol): Promise<void> => {
  const message = {
    sessionId: protocol.getToId().toString(),
    messageId: protocol.getIdentityId().toString(),
    type: protocol.getContentType(),
    fromId: protocol.getFromId().toString(),
    toId: protocol.getToId().toString(),
    content: protocol.getMessageString(),
    status: MessageStatus.TYPE_SUCCESS,
    createdAt: Number(protocol.getTimeStamp()),
    updatedAt: Number(protocol.getTimeStamp())
  } as ChatMessage
  saveMessage(message)
  notifyWindows('receiveMessage', message)
}

export const saveMessage = async (message: ChatMessage): Promise<void> => {
  chatSessionDB.addOrUpdateMessage(message)
  const type = message.type
  if (
    type === Protocol.CONTENT_FILE ||
    type === Protocol.CONTENT_IMAGE ||
    type === Protocol.CONTENT_VIDEO ||
    type === Protocol.CONTENT_VOICE
  ) {
    const user = clientDataStore.get('user') as User
    if (message.fromId == user.id) {
      fileMapDB.updateTempMessageId(message.messageId, message.sessionId, message.createdAt)
    } else {
      const [originName, remoteName, size] = message.content
        ? message.content.split(':')
        : [undefined, undefined, undefined]

      const newFile: FileMap = {
        originName: originName as string,
        remoteName: remoteName as string,
        fingerprint: 'unknow',
        size: Number(size),
        mimeType: getMIMEFromFilename(remoteName as string),
        location: 'unknow',
        status: 0,
        createdAt: message.createdAt,
        updatedAt: message.updatedAt,
        sessionId: message.sessionId,
        messageId: message.messageId,
        sourceInfo: 'unknow'
      }
      fileMapDB.add(newFile)
    }
  }
}
