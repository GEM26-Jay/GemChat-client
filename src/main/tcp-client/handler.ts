import { tokenManager } from '../axios/axiosClient'
import Protocol, { OrderMap } from './protocol'
import { clientDataStore } from '../clientDataStore'
import { NettyClientManager } from './client'
import { User } from '@shared/types'
import {
  handleChatSessionSync,
  handleFriendRequestSync,
  handleGroupSync,
  handleUserFriendSync,
  handleGroupMemberSync,
  handleChatMessageSync
} from './handlers/syncHandler'
import { handleMessageReceive, handleMessageAck } from './handlers/messageHandler'

export const registerNettyHandler = async (
  nettyClientManager: NettyClientManager
): Promise<void> => {
  const nettyClient = nettyClientManager

  // 监听连接事件
  nettyClient.on('connected', () => {
    console.log('Netty: 成功连接到服务器')

    // 创建并发送协议消息
    const protocol = new Protocol()
    protocol.type = Protocol.ORDER_AUTH
    protocol.fromId = BigInt((clientDataStore.get('user') as User).id)
    protocol.setContent(tokenManager.getToken())

    nettyClient.sendProtocol(protocol)
  })

  // 监听消息事件
  nettyClient.on(OrderMap[Protocol.ORDER_MESSAGE], (protocol: Protocol) => {
    handleMessageReceive(protocol)
  })

  // 监听消息应答
  nettyClient.on(OrderMap[Protocol.ORDER_ACK], (protocol: Protocol) => {
    handleMessageAck(protocol)
  })

  // 监听系统推送
  nettyClient.on(OrderMap[Protocol.ORDER_SYSTEM], (protocol: Protocol) => {
    console.log('系统推送:', protocol.getContentString())
  })

  // 监听用户验证请求
  nettyClient.on(OrderMap[Protocol.ORDER_AUTH], (protocol: Protocol) => {
    if (protocol.getContentType() === Protocol.CONTENT_FAILED) {
      console.log('TCP服务器验证失败')
    } else {
      console.log('TCP服务器验证通过')
    }
  })

  // 监听数据同步请求
  nettyClient.on(OrderMap[Protocol.ORDER_SYNC], (protocol: Protocol) => {
    console.log('数据同步:', protocol.getContentString())
    switch (protocol.getContentString()) {
      case 'friend_request': {
        handleFriendRequestSync()
        break
      }
      case 'user_friend': {
        handleUserFriendSync()
        break
      }
      case 'chat_session': {
        handleChatSessionSync()
        break
      }
      case 'chat_group': {
        handleGroupSync()
        break
      }
      case 'group_member': {
        handleGroupMemberSync()
        break
      }
      case 'chat_message': {
        handleChatMessageSync()
        break
      }
    }
  })
}
