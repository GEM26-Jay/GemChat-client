import React from 'react'
import { FaEllipsisH } from 'react-icons/fa'
import MessageBox, { Message } from '../message-box/MessageBox'
import styles from './ChatBoxLayout.module.css'
import VerticalSplitPanel from '../split-panel/VerticalSplitPanel'
import { useParams } from 'react-router'
import SendBox from '../send-box/SendBox'

export interface ChatInfoModel {
  chatType: 'single' | 'group'
  chatId: string
  chatName: string
}

// 模拟聊天消息数据，实际项目中可从接口获取
const mockMessages: Message[] = [
  {
    id: '1',
    userId: 'other1',
    userName: '真真',
    avatarUrl: 'electronSvg',
    msg: '南京挂是最多的',
    time: '2025年6月21日 15:16',
    isMine: false
  },
  {
    id: '2',
    userId: 'mine',
    userName: '我',
    avatarUrl: 'electronSvg',
    msg: '刷到个视频，讲南京服务器挂最多的，青铜白银局都能红',
    time: '2025年6月21日 16:17',
    isMine: true
  },
  {
    id: '3',
    userId: 'other1',
    userName: '真真',
    avatarUrl: 'electronSvg',
    msg: '今天搞不搞',
    time: '2025年6月21日 16:17',
    isMine: false
  },
  {
    id: '4',
    userId: 'mine',
    userName: '我',
    avatarUrl: 'electronSvg',
    msg: '晚上',
    time: '2025年7月9日 22:28',
    isMine: true
  },
  {
    id: '5',
    userId: 'mine',
    userName: '我',
    avatarUrl: 'electronSvg',
    msg: '闪退了',
    time: '2025年7月9日 22:28',
    isMine: true
  }
]

const chatInfo: ChatInfoModel = {
  chatType: 'single',
  chatId: '1',
  chatName: '第一次聊天'
}

const ChatBoxLayout: React.FC = () => {
  const { id } = useParams()

  const topPanel = (
    <div className={styles['topPanel']}>
      <MessageBox messageList={mockMessages}></MessageBox>
    </div>
  )

  const bottomPanel = (
    <div className={styles['bottomPanel']}>
      <SendBox></SendBox>
    </div>
  )

  return (
    <div className={styles['chat-box-container']}>
      {/* 顶部标题栏 */}
      <div className={styles['chat-header']}>
        <span className={styles['chat-header-name']}>{chatInfo.chatName}</span>
        <FaEllipsisH className={styles['chat-setting-icon']} />
      </div>
      <div className={styles['main-chat-panel']}>
        <VerticalSplitPanel
          panelKey="message & send"
          topPanel={topPanel}
          bottomPanel={bottomPanel}
          minTopRatio={0.4}
          maxTopRatio={0.8}
          initTopRatio={0.65}
        ></VerticalSplitPanel>
      </div>
    </div>
  )
}

export default ChatBoxLayout
