import React from 'react'
import styles from './MessageBox.module.css' // 共享样式文件

export interface Message {
  id: string
  userId: string
  userName?: string
  avatarUrl?: string
  msg: string
  time: string
  isMine: boolean
}

interface MessageBoxProps {
  messageList: Message[] // 使用 ChatBox 中定义的 Message 类型
}

const MessageBox: React.FC<MessageBoxProps> = ({ messageList }) => {
  return (
    <ul className={styles['message-box']}>
      {messageList.map((message) => (
        <li
          key={message.id}
          className={styles[message.isMine ? 'message-item-mine' : 'message-item-others']}
        >
          <img src={message.avatarUrl} className={styles['message-avatar']} />
          <div className={styles['message-content']}>
            <div className={styles['message-time']}>{message.time}</div>
            <div className={styles['message-text']}>{message.msg}</div>
          </div>
        </li>
      ))}
    </ul>
  )
}

export default MessageBox
