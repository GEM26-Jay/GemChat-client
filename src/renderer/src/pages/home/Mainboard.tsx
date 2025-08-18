import styles from './MainBoard.module.css'

import { Outlet } from 'react-router'
import Sidebar from './components/sidebar/Sidebar'
import React, { useEffect } from 'react'
import 'modern-normalize/modern-normalize.css'
import { useQueryClient } from '@tanstack/react-query'

function MainBoard(): React.JSX.Element {
  const queryClient = useQueryClient()

  useEffect(() => {
    // 监听主进程的 update 消息
    window.update?.onUpdate((queryKey) => {
      queryClient.invalidateQueries({
        queryKey: [queryKey],
        exact: false // 失效所有相关查询
      })
    })
  }, [queryClient])

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
