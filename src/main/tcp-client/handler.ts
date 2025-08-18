import { tokenManager } from '../axios/axiosClient'
import Protocol from './protocol'
import { clientDataStore } from '../clientDataStore'
import { FriendRequest, User, UserFriend } from '@shared/types'
import { nettyClient } from './client'
import { getFriendRequestSync, getUserFriendSync } from '../axios/axiosFriendApi'
import { friendRequestDB } from '../db-manage/db_friendRequest'
import { userFriendDB } from '../db-manage/db_friends'
import { notifyWindows } from '../index'

const handleFriendRequestSync = async (): Promise<void> => {
  const user = clientDataStore.get('user') as User
  const timestamp = await friendRequestDB.getLatestUpdateTimestamp(user.id)
  const apiResult = await getFriendRequestSync(timestamp)
  if (apiResult.isSuccess) {
    if (apiResult.data) {
      const requestList = apiResult.data as FriendRequest[]
      for (const item of requestList) {
        await friendRequestDB.upsertRequest(item)
      }
      notifyWindows('update', 'friend_request')
      console.log('[handleFriendRequestSync]: 数据同步, 获取数据成功')
    } else {
      console.log('[handleFriendRequestSync]: 数据同步, 无需要同步的数据')
    }
  } else {
    console.log('[handleFriendRequestSync]: 数据同步失败, 服务器访问失败')
  }
}

const handleUserFriendSync = async (): Promise<void> => {
  const user = clientDataStore.get('user') as User
  const timestamp = await userFriendDB.getLatestUpdateTimestamp(user.id)
  const apiResult = await getUserFriendSync(timestamp)
  if (apiResult.isSuccess) {
    if (apiResult.data) {
      const friendList = apiResult.data as UserFriend[]
      for (const item of friendList) {
        await userFriendDB.upsertFriendRelation(item)
      }
      notifyWindows('update', 'user_friend')
      console.log('[handleUserFriendSync]: 数据同步, 获取数据成功')
    } else {
      console.log('[handleUserFriendSync]: 数据同步, 无需要同步的数据')
    }
  } else {
    console.log('[handleUserFriendSync]: 数据同步失败, 服务器访问失败')
  }
}

export const registerClientHandler = (): void => {
  // 监听连接事件
  nettyClient.on('connected', () => {
    console.log('Netty: 成功连接到服务器')

    // 创建并发送协议消息
    const protocol = new Protocol()
    protocol.setType(Protocol.AUTH)
    protocol.setFromId(BigInt((clientDataStore.get('user') as User).id))
    protocol.setToId(0n)
    protocol.setMessage(tokenManager.getToken())

    nettyClient.sendProtocol(protocol)
  })

  // 监听消息事件
  nettyClient.on('message', (protocol: Protocol) => {
    console.log('收到服务器消息:', protocol.getMessageString())
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
    }
  })
}
