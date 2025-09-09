import styles from './MainBoard.module.css'

import { Outlet, useNavigate } from 'react-router'
import Sidebar from './components/sidebar/Sidebar'
import React, { useEffect } from 'react'
import 'modern-normalize/modern-normalize.css'
import { useQueryClient } from '@tanstack/react-query'
import { ChatMessage } from '@shared/types'

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
        // 处理旧数据可能为undefined的情况
        if (!oldData) {
          return [message] // 若旧数据不存在，直接返回包含新消息的数组
        }
        return [...oldData, message]
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
