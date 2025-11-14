import styles from './TextMessageItem.module.css'
import React from 'react'

interface TextMessageItemProps {
  content: string
  isMine: boolean
}

const TextMessageItem: React.FC<TextMessageItemProps> = ({ content, isMine }) => {
  return (
    <div className={styles['message-container']}>
      {/* 根据 isMine 动态切换气泡样式 */}
      <div
        className={`${styles['bubble']} ${isMine ? styles['bubble-mine'] : styles['bubble-others']}`}
      >
        <span className={styles['content']}>{content}</span>
      </div>
    </div>
  )
}

export default TextMessageItem
