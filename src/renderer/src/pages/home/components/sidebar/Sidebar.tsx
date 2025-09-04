import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './Sidebar.module.css'
import { FaComment, FaFolder, FaImages, FaUserFriends, FaCog, FaUserCircle } from 'react-icons/fa'
import LocalImage from '../LocalImage'
import { User } from '@shared/types'
import { UseQueryResult, useQuery } from '@tanstack/react-query'

interface SidebarItem {
  label: string
  path: string
  icon: React.ReactNode
  badge?: number
}

const baseUrl = '/home/'

const menuItems: SidebarItem[] = [
  { label: '聊天', path: `${baseUrl}chat`, icon: <FaComment />, badge: 3 },
  { label: '通讯录', path: `${baseUrl}friend`, icon: <FaUserFriends />, badge: 1 },
  { label: '文件箱', path: `${baseUrl}chat-file`, icon: <FaFolder /> },
  { label: '朋友圈', path: `${baseUrl}moment`, icon: <FaImages /> }
]

const userSettingsItems: SidebarItem[] = [
  { label: '个人中心', path: `${baseUrl}profile`, icon: <FaUserCircle /> }, // 使用圆形用户图标
  { label: '设置', path: `${baseUrl}setting`, icon: <FaCog /> }
]

const Sidebar: React.FC = () => {
  const [activePath, setActivePath] = useState(menuItems[0].path)
  const nav = useNavigate()

  const handleClick = (path: string): void => {
    setActivePath(path)
    nav(path)
  }

  // 提取当前用户查询
  const useCurrentUser = (): UseQueryResult => {
    return useQuery({
      queryKey: ['currentUser'],
      queryFn: async () => {
        const user: User = (await window.clientData.get('user')) as User
        return user
      }
    })
  }

  const { data } = useCurrentUser()
  const user: User = data as User

  return (
    <aside className={styles['sidebar-container']}>
      <div className={styles['sidebar-avatar']}>
        <LocalImage fileName={user?.avatar}></LocalImage>
      </div>
      {/* 主菜单区域 */}
      <div className={styles['sidebar-menu']}>
        {menuItems.map((item, index) => (
          <button
            key={index}
            type="button"
            className={styles[activePath === item.path ? 'sidebar-item--active' : 'sidebar-item']}
            onClick={() => handleClick(item.path)}
          >
            <div className={styles['sidebar-item__icon']}>
              {item.icon}
              {item.badge && <span className={styles['sidebar-badge']}>{item.badge}</span>}
            </div>
            <span className={styles['sidebar-item__label']}>{item.label}</span>
          </button>
        ))}
      </div>

      {/* 用户和设置区域（固定在底部） */}
      <div className={styles['sidebar-footer']}>
        {userSettingsItems.map((item, index) => (
          <button
            key={index}
            type="button"
            className={styles[activePath === item.path ? 'sidebar-item--active' : 'sidebar-item']}
            onClick={() => handleClick(item.path)}
          >
            <div className={styles['sidebar-item__icon']}>{item.icon}</div>
            <span className={styles['sidebar-item__label']}>{item.label}</span>
          </button>
        ))}
      </div>
    </aside>
  )
}

export default Sidebar
