import { chatSessionDB } from '@main/db-manage/db_chatSession'
import Protocol from '../protocol'
import { ChatMessage } from '@shared/types'
import { notifyWindows } from '../../index'

export const handleMessageReceive = async (protocol: Protocol): Promise<void> => {
  const buffer = protocol.getMessageBuffer()
  const messageId = buffer.readBigInt64BE(0).toString()
  const messageBuffer = buffer.slice(8)
  const messageContent = messageBuffer.toString('utf8')
  const message = {
    sessionId: protocol.getToId().toString(),
    messageId: messageId,
    type: protocol.getType() & 0x000000ff,
    fromId: protocol.getFromId().toString(),
    toId: protocol.getToId().toString(),
    content: messageContent,
    status: 1,
    createdAt: Number(protocol.getTimeStamp()),
    updatedAt: Number(protocol.getTimeStamp())
  } as ChatMessage
  chatSessionDB.addOrUpdateMessage(message)
  notifyWindows('receiveMessage', message)
}
