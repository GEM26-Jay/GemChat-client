import React from 'react'
import { FaEllipsisH } from 'react-icons/fa'
import MessageBox from '../message-box/MessageBox'
import styles from './ChatBoxLayout.module.css'
import VerticalSplitPanel from '../split-panel/VerticalSplitPanel'
import { useParams } from 'react-router'
import SendBox from '../send-box/SendBox'
import { useQuery } from '@tanstack/react-query'
import { ApiResult, ChatSession, ChatGroup, User, UserFriend } from '@shared/types'

const ChatBoxLayout: React.FC = () => {
  const { sessionId } = useParams<string>()

  const { data: user } = useQuery<User | null>({
    queryKey: ['current_user'],
    queryFn: () =>
      (window.clientData.get('user') as Promise<User>)
        .then((user: User) => (user ? user : null))
        .catch(() => null),
    staleTime: 30 * 60 * 1000,
    enabled: !!sessionId
  })

  const { data: chatSession } = useQuery<ChatSession | null>({
    queryKey: ['chat_session', sessionId],
    queryFn: () =>
      window.businessApi.chat
        .getSessionById(sessionId as string)
        .then((apiResult: ApiResult<ChatSession>) =>
          apiResult.isSuccess && apiResult.data ? apiResult.data : null
        )
        .catch(() => null),
    staleTime: 30 * 60 * 1000,
    enabled: !!sessionId
  })

  let isValid = true

  let isGroup = false
  let targetUserId = ''
  if (chatSession && user) {
    isGroup = chatSession.type === 1 ? false : true
    targetUserId = !isGroup
      ? user.id === chatSession.secondId
        ? (chatSession.firstId as string)
        : (chatSession.secondId as string)
      : ''
  } else {
    isValid = false
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
    enabled: !isGroup && isValid
  })

  const { data: group } = useQuery<ChatGroup | null>({
    queryKey: ['group', chatSession?.firstId],
    queryFn: () =>
      window.businessApi.chat
        .getGroupById(chatSession?.firstId as string)
        .then((apiResult: ApiResult<ChatGroup>) =>
          apiResult.isSuccess && apiResult.data ? apiResult.data : null
        )
        .catch(() => null),
    staleTime: 30 * 60 * 1000,
    enabled: isGroup && isValid
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
    enabled: !group && isValid
  })

  if (!isValid) {
    return null
  }

  const title = isGroup
    ? group?.name
    : userFriend?.remark
      ? userFriend?.remark
      : targetUser?.username

  const topPanel = (
    <div className={styles['topPanel']}>
      <MessageBox
        isGroup={isGroup}
        userId={user?.id as string}
        sessionId={chatSession?.id as string}
      ></MessageBox>
    </div>
  )

  const bottomPanel = (
    <div className={styles['bottomPanel']}>
      <SendBox sessionId={sessionId as string}></SendBox>
    </div>
  )

  return (
    <div className={styles['chat-box-container']}>
      {/* 顶部标题栏 */}
      <div className={styles['chat-header']}>
        <span className={styles['chat-header-name']}>{title}</span>
        <FaEllipsisH className={styles['chat-setting-icon']} />
      </div>
      <div className={styles['main-chat-panel']}>
        <VerticalSplitPanel
          panelKey="message & send"
          topPanel={topPanel}
          bottomPanel={bottomPanel}
          minTopRatio={0.4}
          maxTopRatio={0.8}
          initTopRatio={0.65}
        ></VerticalSplitPanel>
      </div>
    </div>
  )
}

export default ChatBoxLayout
