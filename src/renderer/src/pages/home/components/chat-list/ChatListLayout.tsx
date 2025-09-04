import React, { useEffect, useState } from 'react'
import ChatListItem from './ChatListItem'
import styles from './ChatListLayout.module.css'
import HorizontalSplitPanel from '../split-panel/HorizontalSplitPanel'
import { Outlet, useNavigate, useParams } from 'react-router'
import HeaderSearchBox from '../search-box/HeaderSearchBox'
import { useQuery } from '@tanstack/react-query'
import { ApiResult, ChatSession, User } from '@shared/types'

const ChatListLayout: React.FC = () => {
  const [actId, setActId] = useState('ActivateChatId')
  const baseUrl = '/home/chat/'
  const nav = useNavigate()
  const { sessionId } = useParams<string>()

  useEffect(() => {
    if (sessionId) {
      setActId(sessionId)
    }
  }, [sessionId])

  // 获取会话列表
  const { data: chatSessions = [] } = useQuery<ChatSession[]>({
    queryKey: ['chat_session'],
    queryFn: () =>
      window.businessApi.chat
        .getChatSessions()
        .then((apiResult: ApiResult<ChatSession[]>) =>
          apiResult.isSuccess && apiResult.data ? apiResult.data : []
        )
        .catch(() => []),
    staleTime: 30 * 60 * 1000
  })

  const { data: user } = useQuery<User | null>({
    queryKey: ['current_user'],
    queryFn: () =>
      (window.clientData.get('user') as Promise<User>)
        .then((user: User) => (user ? user : null))
        .catch(() => null),
    staleTime: 30 * 60 * 1000
  })

  const leftPanel = (
    <div className={styles['leftPanel']}>
      <HeaderSearchBox
        searchCallBack={() => <div></div>}
        addClickCallBack={() => {
          window.windowsApi.openAddSessionWindow()
        }}
      ></HeaderSearchBox>

      <ul className={styles['chatList']}>
        {chatSessions.map((item) => (
          <li
            className={[styles['chat-li'], actId === item.id ? styles['chat-li--active'] : ''].join(
              ' '
            )}
            key={item.id}
            onClick={() => {
              setActId(item.id)
              nav(`${baseUrl}${item.id}`)
            }}
          >
            <ChatListItem chatSession={item} user={user as User} key={item.id} />
          </li>
        ))}
      </ul>
    </div>
  )

  const rightPanel = (
    <div className={styles['rightPanel']}>
      <Outlet></Outlet>
    </div>
  )

  return (
    <div className={styles['container']}>
      <HorizontalSplitPanel
        panelKey="verticalNormal"
        leftPanel={leftPanel}
        rightPanel={rightPanel}
        minLeftRatio={0.3}
        maxLeftRatio={0.5}
        initLeftRatio={0.3}
      ></HorizontalSplitPanel>
    </div>
  )
}

export default ChatListLayout
