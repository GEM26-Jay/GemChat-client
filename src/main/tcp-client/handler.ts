import { tokenManager } from '../axios/axiosClient'
import Protocol from './protocol'
import { clientDataStore } from '../clientDataStore'
import { initNettyClient, nettyClients } from './client'
import { User } from '@shared/types'
import {
  handleChatSessionSync,
  handleFriendRequestSync,
  handleGroupSync,
  handleUserFriendSync,
  handleGroupMemberSync,
  handleChatMessageSync
} from './handlers/syncHandler'
import { handleMessageReceive } from './handlers/messageHandler'

export const registerNettyClient = async (): Promise<void> => {
  let nettyClient
  if (nettyClients.length == 0) {
    nettyClient = await initNettyClient()
  } else {
    nettyClient = nettyClients[0]
  }

  if (nettyClient) {
    nettyClient.connect()
  } else {
    console.log('网络连接失败')
    return
  }

  // 监听连接事件
  nettyClient.on('connected', () => {
    console.log('Netty: 成功连接到服务器')

    // 创建并发送协议消息
    const protocol = new Protocol()
    protocol.setType(Protocol.ORDER_AUTH)
    protocol.setFromId(BigInt((clientDataStore.get('user') as User).id))
    protocol.setToId(0n)
    protocol.setMessage(tokenManager.getToken())

    nettyClient.sendProtocol(protocol)
  })

  // 监听消息事件
  nettyClient.on('message', (protocol: Protocol) => {
    handleMessageReceive(protocol)
  })

  // 监听系统推送
  nettyClient.on('system-push', (protocol: Protocol) => {
    console.log('系统推送:', protocol.getMessageString())
  })

  // 监听数据同步请求
  nettyClient.on('sync', (protocol: Protocol) => {
    console.log('数据同步:', protocol.getMessageString())
    switch (protocol.getMessageString()) {
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
