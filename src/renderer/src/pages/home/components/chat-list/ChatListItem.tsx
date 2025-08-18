import React from 'react'
import styles from './ChatListItem.module.css'
import { ChatListItemType } from './types' // 引入上面定义的类型
import LocalImage from '../LocalImage'

const ChatListItem: React.FC<ChatListItemType> = ({
  avatar,
  title,
  lastMessage,
  time,
  unreadCount,
  isGroup
}) => {
  return (
    <div className={styles['chat-list-item-wrapper']}>
      {/* 头像区域 */}
      <div className={styles['chat-avatar']}>
        <LocalImage fileName={avatar}></LocalImage>
        {unreadCount !== undefined && unreadCount > 0 && (
          <span className={styles['unread-badge']}>{unreadCount}</span>
        )}
      </div>
      {/* 内容区域 */}
      <div className={styles['chat-content']}>
        <div className={styles['chat-info']}>
          <div className={styles['chat-title']}>
            {isGroup && <div className={styles['chat-title-label']}>群聊</div>}
            <span className={styles['chat-title-text']}>{title}</span>
          </div>
          <span className={styles['chat-time']}>{time}</span>
        </div>
        <p className={styles['chat-last-message']}>{lastMessage}</p>
      </div>
    </div>
  )
}

export default ChatListItem
