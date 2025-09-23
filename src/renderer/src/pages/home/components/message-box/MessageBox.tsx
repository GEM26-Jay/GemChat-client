import React, { useEffect, useMemo, useRef } from 'react'
import styles from './MessageBox.module.css'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChatMessage } from '@shared/types'
import MessageItem from './MessageItem'
import { useSelector, useDispatch } from 'react-redux'
import { RootState } from '@renderer/pages/addFriend/store'
import { setMessageCursor } from '../../store/messageCursor'

interface MessageBoxProps {
  userId: string
  sessionId: string
  isGroup: boolean
}

const MessageBox: React.FC<MessageBoxProps> = ({ userId, sessionId, isGroup }: MessageBoxProps) => {
  const queryClient = useQueryClient()
  const queryKey = useMemo(() => ['chat_message', sessionId], [sessionId])
  const dispatch = useDispatch()
  const messageBoxRef = useRef<HTMLUListElement>(null)
  const isFirstLoad = useRef(true)

  // 获取消息数据
  const { data: messages = [] } = useQuery<ChatMessage[]>({
    queryKey: queryKey,
    queryFn: () => [],
    enabled: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false
  })

  // 从Redux获取保存的消息游标
  const savedMessageId = useSelector((state: RootState) => state['messageCursor'][sessionId] ?? '')

  // 加载消息：优化条件（避免重复请求）
  useEffect(() => {
    // 仅当消息为空时请求（避免messages.length<20的模糊判断）
    if (messages.length === 0) {
      window.businessApi.chat.getMessagesBySessionId(sessionId, 1, 20).then((apiResult) => {
        const list: ChatMessage[] = apiResult.data
          ? apiResult.data.sort((a, b) => a.createdAt - b.createdAt)
          : []
        queryClient.setQueryData(queryKey, list)
      })
    }
  }, [queryClient, queryKey, sessionId, messages.length])

  // 消息加载完成后，滚动到保存位置（简化触发逻辑）
  useEffect(() => {
    // 首次加载+有消息+有保存的游标时触发（去掉复杂的isFirstLoad判断）
    if (messages.length > 0 && savedMessageId && isFirstLoad.current) {
      scrollToSavedPosition()
      isFirstLoad.current = false
    }
  }, [messages, savedMessageId])

  // 监听滚动：简化为“找视口最顶部可见元素”，并添加防抖（减少Redux触发频率）
  useEffect(() => {
    const messageBox = messageBoxRef.current
    if (!messageBox) return

    // 防抖：滚动停止300ms后再记录，避免频繁更新Redux
    let scrollTimer: NodeJS.Timeout
    const handleScroll = (): void => {
      clearTimeout(scrollTimer)
      scrollTimer = setTimeout(() => {
        const visibleMessage = getTopVisibleMessage(messageBox)
        if (visibleMessage) {
          const currentMessageId = visibleMessage.dataset.messageId
          if (currentMessageId && currentMessageId !== savedMessageId) {
            dispatch(setMessageCursor({ key: sessionId, messageId: currentMessageId }))
          }
        }
      }, 300)
    }

    messageBox.addEventListener('scroll', handleScroll)
    // 组件卸载时清理定时器+解绑事件（避免内存泄漏）
    return () => {
      clearTimeout(scrollTimer)
      messageBox.removeEventListener('scroll', handleScroll)
    }
  }, [sessionId, savedMessageId, dispatch])

  /**
   * 核心简化：获取视口最顶部的可见消息
   * 逻辑：遍历所有消息，找到“顶部进入视口”且“最靠上”的元素
   */
  const getTopVisibleMessage = (container: HTMLUListElement): HTMLLIElement | undefined => {
    const { scrollTop, clientHeight } = container
    const messages = Array.from(container.children) as HTMLLIElement[]

    // 遍历消息，筛选“可见”且“最顶部”的元素
    return messages.find((messageEl) => {
      const rect = messageEl.getBoundingClientRect()
      // 元素顶部 <= 容器底部（进入视口），且元素底部 > 容器顶部（未完全离开视口）
      return rect.top <= scrollTop + clientHeight && rect.bottom > scrollTop
    })
  }

  /**
   * 滚动到保存的位置：简化为“顶部对齐”
   */
  const scrollToSavedPosition = (): void => {
    const messageBox = messageBoxRef.current
    if (!messageBox || !savedMessageId) return

    const targetElement = messageBox.querySelector(`[data-message-id="${savedMessageId}"]`)
    if (targetElement) {
      // behavior: auto（瞬间定位，比smooth更高效），block: start（顶部对齐，简化逻辑）
      targetElement.scrollIntoView({ behavior: 'auto', block: 'start' })
    }
  }

  console.log(messages)

  return (
    <ul ref={messageBoxRef} className={styles['message-box']}>
      {messages.map((message) => (
        <li
          key={message.messageId}
          data-message-id={message.messageId}
          className={savedMessageId === message.messageId ? styles['current-cursor'] : ''}
        >
          <MessageItem userId={userId} isGroup={isGroup} message={message} />
        </li>
      ))}
    </ul>
  )
}

export default MessageBox
