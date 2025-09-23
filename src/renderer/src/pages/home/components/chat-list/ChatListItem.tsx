import React from 'react'
import styles from './ChatListItem.module.css'
import LocalImage from '../LocalImage'
import { ApiResult, ChatSession, ChatGroup, User, UserFriend } from '@shared/types'
import { useQuery } from '@tanstack/react-query'

const formatRelativeTime = (timestamp: number): string => {
  const date = new Date(timestamp)
  const now = new Date()

  // 获取年月日时分
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hours = date.getHours()
  const minutes = date.getMinutes()

  // 判断是否为同一天
  const isSameDay =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()

  // 判断是否为同一年
  const isSameYear = date.getFullYear() === now.getFullYear()

  if (isSameDay) {
    // 同一天显示 时:分
    return `${hours}:${minutes}`
  } else if (isSameYear) {
    // 同一年显示 月:日
    return `${month}月${day}日`
  } else {
    // 不同年显示 年-月-日
    return `${year}年${month}月${day}日`
  }
}

export interface ChatListItemType {
  id: string // 聊天会话唯一标识
  avatar: string // 头像图片地址
  title: string // 聊天对象标题（群名称、联系人名称等）
  lastMessage: string // 最后一条消息内容
  time: string // 消息时间
  unreadCount?: number // 未读消息数量（可选）
  isGroup?: boolean
}
const ChatListItem: React.FC<{ chatSession: ChatSession; user: User }> = ({
  chatSession,
  user
}) => {
  const isGroup = chatSession.type === 1 ? false : true
  let targetUserId: string = ''
  if (!isGroup) {
    if (chatSession.secondId !== null && chatSession.firstId !== null) {
      targetUserId = user.id === chatSession.secondId ? chatSession.firstId : chatSession.secondId
    }
  }

  const { data: targetUser } = useQuery<User | null>({
    queryKey: ['user', targetUserId],
    queryFn: () =>
      window.businessApi.user
        .selectById(targetUserId)
        .then((apiResult: ApiResult<User>) =>
          apiResult.isSuccess && apiResult.data ? apiResult.data : null
        )
        .catch(() => null),
    staleTime: 30 * 60 * 1000,
    enabled: !isGroup
  })

  const { data: group } = useQuery<ChatGroup | null>({
    queryKey: ['group', chatSession.firstId],
    queryFn: () =>
      window.businessApi.chat
        .getGroupById(chatSession.firstId as string)
        .then((apiResult: ApiResult<ChatGroup>) =>
          apiResult.isSuccess && apiResult.data ? apiResult.data : null
        )
        .catch(() => null),
    staleTime: 30 * 60 * 1000,
    enabled: isGroup
  })

  // 获取好友
  const { data: userFriend } = useQuery<UserFriend | null>({
    queryKey: ['user_friend', targetUserId],
    queryFn: () =>
      window.businessApi.friend
        .getByTargetId(targetUserId)
        .then((apiResult: ApiResult<UserFriend>) =>
          apiResult.isSuccess && apiResult.data ? apiResult.data : null
        )
        .catch(() => null),
    staleTime: 30 * 60 * 1000,
    enabled: !group
  })

  const avatar = isGroup ? group?.avatar : targetUser?.avatar
  const title = isGroup
    ? group?.name
    : userFriend?.remark
      ? userFriend?.remark
      : targetUser?.username
  const time = chatSession.lastMessageTime
  const lastMessage = chatSession.lastMessageContent
  const unreadCount = 0

  return (
    <div className={styles['chat-list-item-wrapper']}>
      {/* 头像区域 */}
      <div className={styles['chat-avatar']}>
        {isGroup && <div className={styles['chat-title-label']}>群聊</div>}
        <LocalImage fileName={avatar}></LocalImage>
        {unreadCount !== undefined && unreadCount > 0 && (
          <span className={styles['unread-badge']}>{unreadCount}</span>
        )}
      </div>
      {/* 内容区域 */}
      <div className={styles['chat-content']}>
        <div className={styles['chat-info']}>
          <div className={styles['chat-title']}>
            <span className={styles['chat-title-text']}>{title}</span>
          </div>
          <span className={styles['chat-time']}>{time ? formatRelativeTime(time) : <br></br>}</span>
        </div>
        <p className={styles['chat-last-message']}>
          {lastMessage} <br></br>
        </p>
      </div>
    </div>
  )
}

export default ChatListItem
