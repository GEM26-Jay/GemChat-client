import React, { useState } from 'react'
import ChatListItem from './ChatListItem'
import { ChatListItemType as ChatListItemType } from './types' // 注意别名避免冲突
import styles from './ChatListLayout.module.css'
import HorizontalSplitPanel from '../split-panel/HorizontalSplitPanel'
import { Outlet, useNavigate } from 'react-router'
import HeaderSearchBox from '../search-box/HeaderSearchBox'

const chatListData: ChatListItemType[] = [
  {
    id: '1',
    avatar: '',
    title: '23级北呀呀呀呀呀呀呀呀呀呀呀呀。',
    lastMessage: '徐老师: [链接] @SCNUer 学宿姚湘 (农3.4): [链接] 2025年',
    time: '17:15',
    unreadCount: 1,
    isGroup: false
  },
  {
    id: '2',
    avatar: '',
    title: '妈妈 3.29',
    lastMessage: '哦',
    time: '14:49',
    unreadCount: 0,
    isGroup: false
  },
  {
    id: '3',
    avatar: '',
    title: '北斗23班级通知群',
    lastMessage:
      '姚湘 (农3.4): [链接] 2025年姚湘 (农3.4): [链接] 2025年姚湘 (农3.4): [链接] 2025年',
    time: '2025/07/21',
    unreadCount: 0,
    isGroup: true
  },
  {
    id: '4',
    avatar: '',
    title: '真真 12.27',
    lastMessage: '闪退了',
    time: '2025/07/09',
    unreadCount: 0,
    isGroup: false
  },
  {
    id: '5',
    avatar: '',
    title: '公众号',
    lastMessage: '杭州西湖风景名胜区: [链接] 诗画姚湘 (农3.4): [链接] 2025年',
    time: '21:09',
    unreadCount: 0,
    isGroup: true
  }
  // 可继续添加更多模拟数据...
]

const ChatListLayout: React.FC = () => {
  const [actId, setActId] = useState('ActivateChatId')
  const baseUrl = '/home/chat/'
  const nav = useNavigate()

  const leftPanel = (
    <div className={styles['leftPanel']}>
      <HeaderSearchBox
        searchCallBack={() => <div></div>}
        addClickCallBack={() => {}}
      ></HeaderSearchBox>

      <ul className={styles['chatList']}>
        {chatListData.map((item) => (
          <li
            className={styles[actId === item.id ? 'chat-li--active' : 'chat-li']}
            key={item.id}
            onClick={() => {
              setActId(item.id)
              nav(`${baseUrl}${item.id}`)
            }}
          >
            <ChatListItem {...item} key={item.id} />
          </li>
        ))}
      </ul>
    </div>
  )

  const rightPanel = (
    <div className={styles['rightPanel']}>
      <Outlet></Outlet>
    </div>
  )

  return (
    <div className={styles['container']}>
      <HorizontalSplitPanel
        panelKey="verticalNormal"
        leftPanel={leftPanel}
        rightPanel={rightPanel}
        minLeftRatio={0.3}
        maxLeftRatio={0.5}
        initLeftRatio={0.3}
      ></HorizontalSplitPanel>
    </div>
  )
}

export default ChatListLayout
