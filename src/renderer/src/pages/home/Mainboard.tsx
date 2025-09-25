import styles from './MainBoard.module.css'

import { Outlet, useNavigate } from 'react-router'
import Sidebar from './components/sidebar/Sidebar'
import React, { useEffect } from 'react'
import 'modern-normalize/modern-normalize.css'
import { useQueryClient } from '@tanstack/react-query'
import { ChatMessage } from '@shared/types'

// 抽离排序函数，提升可读性
const sortMessages = (a: ChatMessage, b: ChatMessage): number => {
  // 按messageId排序（保证顺序稳定）
  return a.messageId.localeCompare(b.messageId)
}

function MainBoard(): React.JSX.Element {
  const queryClient = useQueryClient()
  const nav = useNavigate()

  useEffect(() => {
    // 监听主进程的 update 消息
    window.update?.onUpdate((queryKey) => {
      queryClient.invalidateQueries({
        queryKey: [queryKey],
        exact: false // 失效所有相关查询
      })
    })
    window.windowsApi.onNavigateMainWindow((navPath) => {
      nav(navPath)
    })
    window.businessApi.chat.onReceiveMessage((message: ChatMessage) => {
      const queryKey = ['chat_message', message.sessionId]
      queryClient.setQueryData<ChatMessage[]>(queryKey, (oldData) => {
        // 1. 处理旧数据为undefined的情况
        if (!oldData) {
          return [message]
        }
        const messageIndex = oldData.findIndex((item) => {
          // 匹配临时消息（用createdAt + sessionId，因为temp消息ID不固定）
          if (item.createdAt === message.createdAt && item.sessionId === message.sessionId) {
            if (item.messageId.startsWith('temp') || item.messageId === message.messageId) {
              return true
            }
          }
          return false
        })

        // 3. 严格遵循不可变性：始终返回新数组
        let newData: ChatMessage[]
        if (messageIndex > -1) {
          // 替换逻辑：用map生成新数组（不修改原数组）
          newData = oldData.map((item, index) => (index === messageIndex ? message : item))
        } else {
          // 新增逻辑：用扩展运算符生成新数组
          newData = [...oldData, message]
        }

        console.log('newData', newData)
        // 4. 稳定排序：时间相同则按messageId排序（保证顺序固定）
        newData.sort((a, b) => sortMessages(a, b))
        return newData
      })
    })
  }, [queryClient, nav])

  return (
    <div className={styles['appContainer']}>
      <div className={styles['sidebarWrapper']}>
        <Sidebar />
      </div>
      <div className={styles['outletWrapper']}>
        <Outlet></Outlet>
      </div>
    </div>
  )
}

export default MainBoard
