import React, { useEffect } from 'react'
import styles from './MessageBox.module.css' // 共享样式文件
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChatMessage } from '@shared/types'
import MessageItem from './MessageItem'

interface MessageBoxProps {
  userId: string
  sessionId: string
  isGroup: boolean
}

const MessageBox: React.FC<MessageBoxProps> = ({ userId, sessionId, isGroup }: MessageBoxProps) => {
  const queryClient = useQueryClient()
  const queryKey = ['chat_message', sessionId]

  const { data: messages = [] } = useQuery<ChatMessage[]>({
    queryKey: queryKey,
    queryFn: () => [],
    enabled: false
  })

  useEffect(() => {
    if (messages.length === 0) {
      window.businessApi.chat.getMessagesBySessionId(sessionId, 1, 30).then((apiResult) => {
        const list: ChatMessage[] = apiResult.data ? apiResult.data : []
        list.sort((a, b) => a.createdAt - b.createdAt)
        queryClient.setQueryData(queryKey, apiResult.data)
      })
    }
  }, [messages, queryClient, queryKey, sessionId])

  return (
    <ul className={styles['message-box']}>
      {messages.map((message) => (
        <li key={message.id}>
          <MessageItem userId={userId} isGroup={isGroup} message={message}></MessageItem>
        </li>
      ))}
    </ul>
  )
}

export default MessageBox
