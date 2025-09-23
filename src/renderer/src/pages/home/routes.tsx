import { createBrowserRouter } from 'react-router-dom'

import MainBoard from './Mainboard'
import ChatListLayout from './components/chat-list/ChatListLayout'
import ChatBoxLayout from './components/chat-box/ChatBoxLayout'
import FriendListLayout from './components/friend-list/FriendListLayout'
import FriendRequestBox from './components/friend-request-box/FriendRequestBox'

import UserInfoPanel from './components/user-info-panel/UserInfoPanel'
import FriendBlockBox from './components/friend-block-box/FriendBlockBox'
import SelfInfoPanel from './components/self-info-panel/SelfInfoPanel'
import FileBox from './components/file-box/FileBox'
import SettingPanel from './components/setting-pannel/SettingPanel'

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
            path: ':sessionId',
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
        element: <FileBox></FileBox>
      },
      {
        path: 'moment',
        element: <div>朋友圈功能暂未开放</div>
      },
      {
        path: 'profile',
        element: <SelfInfoPanel></SelfInfoPanel>
      },
      {
        path: 'setting',
        element: <SettingPanel></SettingPanel>
      }
    ]
  }
])

export default router
