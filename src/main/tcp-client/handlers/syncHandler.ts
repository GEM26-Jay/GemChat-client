import { friendRequestDB } from '../../db-manage/db_friendRequest'
import { notifyWindows } from '../..'
import { clientDataStore } from '../../clientDataStore'
import { getFriendRequestSync, getUserFriendSync } from '../../axios/axiosFriendApi'
import {
  ApiResult,
  ChatMessage,
  ChatSession,
  FriendRequest,
  ChatGroup,
  GroupMember,
  User,
  UserFriend,
  MessageType
} from '@shared/types'
import { userFriendDB } from '../../db-manage/db_friends'
import {
  ChatMessageSyncItem,
  getChatMessageSyncBatch,
  getChatSessionSync,
  getGroupMemberSync,
  getGroupSync
} from '../../axios/axiosChatApi'
import { chatSessionDB } from '../../db-manage/db_chatSession'
import { groupDB } from '../../db-manage/db_group'
import { saveFileMessage } from './messageHandler'

export const handleFriendRequestSync = async (): Promise<void> => {
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

export const handleUserFriendSync = async (): Promise<void> => {
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

export const handleChatSessionSync = async (): Promise<void> => {
  const user: User = clientDataStore.get('user') as User
  const latestAt = await chatSessionDB.getLatestSingleSessionUpdateAt(user.id)
  const apiResult: ApiResult<ChatSession[]> = await getChatSessionSync(latestAt)
  if (apiResult.isSuccess) {
    if (apiResult.data) {
      for (const item of apiResult.data) {
        await chatSessionDB.addOrUpdateSession(item)
      }
      notifyWindows('update', 'chat_session')
      console.log('[handleChatSessionSync]: 数据同步, 获取数据成功')
    } else {
      console.log('[handleChatSessionSync]:  数据同步, 无需同步数据')
    }
  } else {
    console.log('[handleChatSessionSync]:  数据同步失败, 服务器访问失败')
  }
}

export const handleGroupSync = async (): Promise<void> => {
  const user: User = clientDataStore.get('user') as User
  const groupIds: string[] = await groupDB.getGroupIdsByUserId(user.id)
  const latestUpdatedAt = await groupDB.getGroupLatestUpdatedAt(groupIds)
  const apiResult: ApiResult<ChatGroup[]> = await getGroupSync(latestUpdatedAt)
  if (apiResult.isSuccess) {
    if (apiResult.data) {
      for (const item of apiResult.data) {
        groupDB.addOrUpdateGroup(item)
      }
      notifyWindows('update', 'group')
      console.log('[handleGroupSync]: 数据同步, 获取数据成功')
    } else {
      console.log('[handleGroupSync]:  数据同步, 无需同步数据')
    }
  } else {
    console.log('[handleGroupSync]:  数据同步失败, 服务器访问失败')
  }
}

export const handleGroupMemberSync = async (): Promise<void> => {
  const user: User = clientDataStore.get('user') as User
  const groupIds: string[] = await groupDB.getGroupIdsByUserId(user.id)
  const latestUpdatedAt = await groupDB.getGroupMemberLatestUpdatedAt(groupIds)
  const apiResult: ApiResult<GroupMember[]> = await getGroupMemberSync(latestUpdatedAt)
  if (apiResult.isSuccess) {
    if (apiResult.data) {
      for (const item of apiResult.data) {
        groupDB.addOrUpdateGroupMember(item)
      }
      notifyWindows('update', 'group_member')
      notifyWindows('update', 'group')
      console.log('[handleChatSessionSync]: 数据同步, 获取数据成功')
    } else {
      console.log('[handleChatSessionSync]:  数据同步, 无需同步数据')
    }
  } else {
    console.log('[handleChatSessionSync]:  数据同步失败, 服务器访问失败')
  }
}

export const handleChatMessageSync = async (): Promise<void> => {
  const user: User = clientDataStore.get('user') as User
  const singleSessions: ChatSession[] = await chatSessionDB.getSingleSessionsByUserId(user.id)
  const groupIds: string[] = await groupDB.getGroupIdsByUserId(user.id)
  const groupSessions: ChatSession[] = await chatSessionDB.getGroupSessionsByGroupIds(groupIds)
  const sessionList: ChatSession[] = singleSessions.concat(groupSessions)
  // 1. 异步生成包含 Promise 的数组（每个元素对应一个异步请求结果）
  const promiseList: Promise<ChatMessageSyncItem>[] = sessionList.map(async (item) => {
    // 回调标记为 async，返回 Promise
    return {
      sessionId: item.id,
      // 2. 等待异步方法执行完成，获取 lastMessageId
      lastMessageId: await chatSessionDB.getLastMessageIdBySessionId(item.id)
    }
  })

  // 3. 等待所有 Promise 完成，得到最终的 ChatMessageSyncItem 数组
  const itemList: ChatMessageSyncItem[] = await Promise.all(promiseList)
  const apiResult: ApiResult<ChatMessage[]> = await getChatMessageSyncBatch(itemList)
  if (apiResult.isSuccess) {
    if (apiResult.data) {
      for (const item of apiResult.data) {
        await chatSessionDB.addOrUpdateMessage(item)
        if (
          item.type === MessageType.IMAGE ||
          item.type === MessageType.VIDEO ||
          item.type === MessageType.OTHER_FILE
        ) {
          await saveFileMessage(item)
        }
      }
      notifyWindows('update', 'chat_message')
      notifyWindows('update', 'chat_session')
      console.log('[handleChatMessageSync]: 数据同步, 获取数据成功')
    } else {
      console.log('[handleChatMessageSync]:  数据同步, 无需同步数据')
    }
  } else {
    console.log('[handleChatMessageSync]:  数据同步失败, 服务器访问失败')
  }
}

export const HandleAllSync = async (): Promise<void> => {
  // 注意同步的先后顺序
  await handleFriendRequestSync()
  await handleUserFriendSync()
  await handleGroupSync()
  await handleGroupMemberSync()
  await handleChatSessionSync()
  await handleChatMessageSync()
}
