import React, { useEffect, useRef, useState, useCallback } from 'react'
import styles from './MessageBox.module.css'
import { ChatMessage } from '@shared/types'
import MessageItem from './message-item/MessageItem'
import { FaSpinner } from 'react-icons/fa'

// 节流函数：限制滚轮触发频率
const throttle = (fn: (...args: any[]) => void, delay: number) => {
  let lastTime = 0
  return (...args: any[]) => {
    const now = Date.now()
    if (now - lastTime >= delay) {
      fn(...args)
      lastTime = now
    }
  }
}

interface MessageBoxProps {
  userId: string
  sessionId: string
  isGroup: boolean
}

const MessageBox: React.FC<MessageBoxProps> = ({ userId, sessionId, isGroup }) => {
  const messageBoxRef = useRef<HTMLUListElement>(null)
  const [sendingList, setSendingList] = useState<ChatMessage[]>([])
  const [messageList, setMessagesList] = useState<ChatMessage[]>([])
  const [topMsgTimestamp, setTopMsgTimestamp] = useState<number>(100000000000)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false)
  const [hasMore, setHasMore] = useState<boolean>(true)
  const [isAtTop, setIsAtTop] = useState<boolean>(false)

  // todo: 待优化，游标部分加载数据
  useEffect(() => {
    setTopMsgTimestamp(100000000000)
  }, [sessionId])

  // 发送消息处理
  const handleSendMessage = useCallback(
    (message: ChatMessage): void => {
      if (message.sessionId !== sessionId) return

      setSendingList((prev) => {
        const isDuplicate = prev.some((item) => item.identityId === message.identityId)
        if (isDuplicate) return prev
        const newList = [...prev, message]
        setTimeout(scrollToBottom, 0) // 新消息自动到底部
        return newList
      })
    },
    [sessionId]
  )

  // 接收消息处理
  const handleReceiveMessage = useCallback(
    (message: ChatMessage): void => {
      if (message.sessionId !== sessionId || !message.messageId) return

      setMessagesList((prev) => {
        const isDuplicate = prev.some((item) => item.messageId === message.messageId)
        if (isDuplicate) return prev
        const newList = [...prev, message].sort((a, b) => a.updatedAt - b.updatedAt)
        setTimeout(scrollToBottomIfNotScrolled, 0) // 接近底部时自动滚动
        return newList
      })
    },
    [sessionId]
  )

  // 消息应答处理
  const handleMessageAck = useCallback(
    (message: ChatMessage): void => {
      if (message.sessionId !== sessionId || !message.identityId || !message.messageId) return
      console.log('接收到消息 ACK: ' + message.messageId + ':' + message.status)
      // 从发送列表移除
      setSendingList((prev) => prev.filter((item) => item.identityId !== message.identityId))

      // 添加到消息列表
      setMessagesList((prev) => {
        const isDuplicate = prev.some((item) => item.messageId === message.messageId)
        if (isDuplicate) return prev
        return [...prev, message].sort((a, b) => a.updatedAt - b.updatedAt)
      })
    },
    [sessionId]
  )

  // 初始化加载消息
  useEffect(() => {
    const loadInitialMessages = async (): Promise<void> => {
      try {
        // const apiResult = await window.businessApi.chat.getMessagesBySessionIdUsingCursor(
        //   sessionId,
        //   topMsgTimestamp,
        //   10
        // )
        // todo: 游标消息存在BUG，无法使用
        const apiResult = await window.businessApi.chat.getMessagesBySessionId(sessionId, 1, 1000)
        if (apiResult.isSuccess && apiResult.data) {
          const sortedList = apiResult.data.sort((a, b) => a.updatedAt - b.updatedAt)
          setMessagesList(sortedList)
          setHasMore(sortedList.length >= 10)
          if (sortedList.length > 0) {
            setTopMsgTimestamp(sortedList[0].updatedAt)
          }
          setTimeout(scrollToBottom, 0) // 初始加载后滚动到底部
        }
      } catch (err) {
        console.error('初始化消息加载失败:', err)
      } finally {
        setIsLoading(false)
      }
    }

    loadInitialMessages()
  }, [sessionId])

  // 加载更多历史消息（强制最小加载时间）
  // const loadMoreHistory = useCallback(async () => {
  //   if (!hasMore || isLoadingMore || messageList.length === 0) return

  //   setIsLoadingMore(true)
  //   const MIN_LOADING_DURATION = 600 // 最小加载动画时长（毫秒）
  //   const startTime = Date.now()

  //   try {
  //     const apiResult = await window.businessApi.chat.getMessagesBySessionIdUsingCursor(
  //       sessionId,
  //       topMsgTimestamp,
  //       10
  //     )
  //     if (apiResult.isSuccess && apiResult.data && apiResult.data.length > 0) {
  //       const newMessages = apiResult.data.sort((a, b) => a.updatedAt - b.updatedAt)
  //       setMessagesList((prev) => {
  //         const existingIds = new Set(prev.map((msg) => msg.messageId))
  //         const uniqueNew = newMessages.filter((msg) => !existingIds.has(msg.messageId))
  //         return [...uniqueNew, ...prev]
  //       })
  //       setTopMsgTimestamp(newMessages[0].updatedAt)
  //       setHasMore(newMessages.length >= 10)
  //     } else {
  //       setHasMore(false)
  //     }
  //   } catch (err) {
  //     console.error('加载更多消息失败:', err)
  //   } finally {
  //     // 确保动画至少展示600ms
  //     const elapsed = Date.now() - startTime
  //     const delay = Math.max(MIN_LOADING_DURATION - elapsed, 0)
  //     setTimeout(() => setIsLoadingMore(false), delay)
  //   }
  // }, [sessionId])

  // 滚动到底部
  const scrollToBottom = () => {
    const container = messageBoxRef.current
    if (container) container.scrollTop = container.scrollHeight
  }

  // 仅在用户未手动滚动时自动到底部
  const scrollToBottomIfNotScrolled = () => {
    const container = messageBoxRef.current
    if (!container) return
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 200
    if (isNearBottom) scrollToBottom()
  }

  // 滚动监听（带节流）
  // useEffect(() => {
  //   const container = messageBoxRef.current
  //   if (!container) return

  //   const handleScroll = () => {
  //     setIsAtTop(container.scrollTop <= 0)
  //   }

  //   const throttledLoadMore = throttle(loadMoreHistory, 800) // 800ms内最多触发一次

  //   const handleWheel = (e: WheelEvent) => {
  //     if (isAtTop && e.deltaY < 0 && !isLoadingMore && hasMore) {
  //       throttledLoadMore()
  //       e.preventDefault()
  //     }
  //   }

  //   container.addEventListener('scroll', handleScroll)
  //   container.addEventListener('wheel', handleWheel, { passive: false })

  //   return () => {
  //     container.removeEventListener('scroll', handleScroll)
  //     container.removeEventListener('wheel', handleWheel)
  //   }
  // }, [isAtTop, isLoadingMore, hasMore, loadMoreHistory])

  // 事件绑定与解绑
  useEffect(() => {
    window.businessApi.chat.onSendMessage(handleSendMessage)
    window.businessApi.chat.onReceiveMessage(handleReceiveMessage)
    window.businessApi.chat.onMessageAckSuccess(handleMessageAck)
    window.businessApi.chat.onMessageAckFailed(handleMessageAck)
  }, [handleSendMessage, handleReceiveMessage, handleMessageAck])

  console.log("messageList: " + JSON.stringify(messageList.length))
  console.log("sendingList: " + JSON.stringify(sendingList.length))
  return (
    <>
      {isLoading ? (
        // 初始加载动画
        <div className={styles['initial-loading']}>
          <FaSpinner className={styles['spinner']} size={36} />
        </div>
      ) : (
        <ul ref={messageBoxRef} className={styles['message-container']}>
          {/* 顶部加载更多提示 */}
          {isLoadingMore && (
            <li className={styles['loading-more']}>
              <FaSpinner className={styles['spinner']} size={18} />
              <span className={styles['loading-text']}>加载历史消息中...</span>
            </li>
          )}

          {/* 空状态 */}
          {messageList.length === 0 && !isLoadingMore ? (
            <li className={styles['empty-state']}>暂无消息，开始聊天吧~</li>
          ) : (
            // 消息列表
            messageList.map((message) => (
              <li
                key={message.messageId}
                data-timestamp={message.updatedAt}
                className={styles['message-item']}
              >
                <MessageItem userId={userId} isGroup={isGroup} message={message} inOps={false} />
              </li>
            ))
          )}

          {/* 发送中的消息 */}
          {sendingList.map((message) => (
            <li
              key={message.identityId}
              className={`${styles['message-item']} ${styles['sending']}`}
            >
              <MessageItem userId={userId} isGroup={isGroup} message={message} inOps={true} />
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

export default MessageBox
