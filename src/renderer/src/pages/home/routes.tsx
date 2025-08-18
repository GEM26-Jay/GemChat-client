import { createBrowserRouter } from 'react-router-dom'

import MainBoard from './Mainboard'
import ChatListLayout from './components/chat-list/ChatListLayout'
import ChatBoxLayout from './components/chat-box/ChatBoxLayout'
import FriendListLayout from './components/friend-list/FriendListLayout'
import FriendRequestBox from './components/friend-request-box/FriendRequestBox'

import UserInfoPanel from './components/user-info-panel/UserInfoPanel'
import FriendBlockBox from './components/friend-block-box/FriendBlockBox'

const router = createBrowserRouter([
  {
    path: '/home',
    element: <MainBoard></MainBoard>,
    children: [
      {
        index: true,
        element: <ChatListLayout />
      },
      {
        path: 'chat',
        element: <ChatListLayout />,
        children: [
          {
            path: ':id',
            element: <ChatBoxLayout></ChatBoxLayout>
          }
        ]
      },
      {
        path: 'friend',
        element: <FriendListLayout></FriendListLayout>,
        children: [
          {
            path: 'addList',
            element: <FriendRequestBox></FriendRequestBox>
          },
          {
            path: 'blockList',
            element: <FriendBlockBox></FriendBlockBox>
          },
          {
            path: ':id',
            element: <UserInfoPanel></UserInfoPanel>
          }
        ]
      },
      {
        path: 'chat-file',
        element: <div>聊天文件</div>
      },
      {
        path: 'moment',
        element: <div>朋友圈</div>
      },
      {
        path: 'profile',
        element: <div>个人中心</div>
      },
      {
        path: 'setting',
        element: <div>朋友圈</div>
      }
    ]
  }
])

export default router
