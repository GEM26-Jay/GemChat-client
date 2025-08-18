import { Outlet, useNavigate } from 'react-router'
import HorizontalSplitPanel from '../split-panel/HorizontalSplitPanel'
import styles from './FriendListLayout.module.css'
import { useState } from 'react'
import { ApiResult, User, UserFriend, UserFriendProfile } from '@shared/types'
import LocalImage from '../LocalImage'
import HeaderSearchBox from '../search-box/HeaderSearchBox'
import { FaUserLock, FaUserPlus } from 'react-icons/fa6'
import { useQueries, useQuery } from '@tanstack/react-query'

const FriendListLayout: React.FC = () => {
  const [activatedId, setActivatedId] = useState<string>('')
  const nav = useNavigate()

  // 获取好友列表
  const { data: friends = [] } = useQuery<UserFriend[]>({
    queryKey: ['user_friend'],
    queryFn: () =>
      window.businessApi.friend
        .getValidFriends()
        .then((apiResult: ApiResult<UserFriend[]>) =>
          apiResult.isSuccess && apiResult.data ? apiResult.data : []
        )
        .catch(() => []),
    staleTime: 30 * 60 * 1000
  })

  // 批量获取每个好友的详细信息
  const friendQueries = useQueries({
    queries: friends.map((friend) => ({
      queryKey: ['user', friend.friendId],
      queryFn: () =>
        window.businessApi.user
          .selectById(friend.friendId)
          .then((apiResult: ApiResult<User>) =>
            apiResult.isSuccess && apiResult.data ? apiResult.data : null
          )
    }))
  })

  // 合并好友列表和详细信息
  const friendProfiles: UserFriendProfile[] = friends.map((friend, index) => ({
    ...(friendQueries[index].data || {
      id: friend.friendId,
      username: '加载中...',
      avatar: '',
      signature: '',
      gender: 0,
      birthdate: '',
      status: 1,
      createdAt: 0,
      updatedAt: 0
    }),
    remark: friend.remark
  }))

  const handlerSearch = (text: string): React.ReactNode => {
    // 1. 处理空输入：直接返回空列表或提示
    if (!text.trim()) {
      return <ul className={styles['empty-result']}></ul> // 空输入时返回空列表
    }

    const lowerText = text.toLowerCase()

    const resultList = friendProfiles.filter((item) => {
      const usernameMatch = item.username.toLowerCase().includes(lowerText)
      const remarkMatch = item.remark ? item.remark.toLowerCase().includes(lowerText) : false
      const phoneMatch = item.maskedPhone ? item.maskedPhone.includes(lowerText) : false
      const emailMatch = item.maskedEmail
        ? item.maskedEmail.toLowerCase().includes(lowerText)
        : false
      return usernameMatch || remarkMatch || phoneMatch || emailMatch
    })

    // 4. 处理无结果场景
    if (resultList.length === 0) {
      return (
        <ul className={styles['no-result']}>
          <li>未找到匹配的联系人</li>
        </ul>
      )
    }

    // 5. 渲染搜索结果
    return (
      <ul className={styles['search-result-list']}>
        {resultList.map((item) => (
          // 修复：添加 key 属性（React 列表渲染必需）
          <li
            key={item.id}
            className={styles['searchItem']}
            onClick={() => {
              nav(`/home/friend/${item.id}`)
              const navLi = document.querySelector(`[key="{friend-li-${item.id}}"]`)
              if (navLi) {
                navLi.scrollIntoView({
                  behavior: 'smooth', // 平滑滚动
                  block: 'nearest' // 滚动到最近的可视位置
                })
              }
            }}
          >
            <LocalImage
              className={styles['searchItemAvatar']}
              fileName={item.avatar || 'default-avatar.png'} // 增加默认头像容错
              alt={item.username} // 增加 alt 属性，提升可访问性
            />
            <span className={styles['searchItemUserName']}>
              {item.remark || item.username} {/* 简化三目运算符为 || */}
            </span>
          </li>
        ))}
      </ul>
    )
  }

  const leftPanel = (
    <div className={styles['leftPanel']}>
      <HeaderSearchBox
        searchCallBack={handlerSearch}
        addClickCallBack={() => {
          window.windowsApi.openAddFriendWindow()
        }}
      ></HeaderSearchBox>

      <div
        className={`${styles['friend-li']} ${activatedId === 'addList' ? styles['friend-li-activated'] : ''}`}
        onClick={() => {
          setActivatedId('addList')
          nav('/home/friend/addList')
        }}
      >
        <FaUserPlus className={styles['friend-li-avatar']}></FaUserPlus>
        <span className={styles['friend-li-name']}>新的朋友</span>
      </div>

      <div
        className={`${styles['friend-li']} ${activatedId === 'blockList' ? styles['friend-li-activated'] : ''}`}
        onClick={() => {
          setActivatedId('blockList')
          nav('/home/friend/blockList')
        }}
      >
        <FaUserLock className={styles['friend-li-avatar']}></FaUserLock>
        <span className={styles['friend-li-name']}>黑名单</span>
      </div>

      <div className={styles['friendsListTitle']}>
        <span className={styles['friendsListTitle-text']}>好友列表</span>
        <span className={styles['friendsListTitle-count']}>{friends.length}</span>
      </div>

      <ul className={styles['friendsList']}>
        {friendProfiles.map((item) => (
          <li
            key={`friend-li-${item.id}`}
            className={`${styles['friend-li']} ${activatedId === item.id ? styles['friend-li-activated'] : ''}`}
            onClick={() => {
              setActivatedId(item.id)
              nav(`/home/friend/${item.id}`)
            }}
          >
            <LocalImage
              fileName={item.avatar}
              alt="avatar"
              className={styles['friend-li-avatar']}
            ></LocalImage>
            <span className={styles['friend-li-name']}>
              {item.remark ? item.remark : item.username}
            </span>
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
    <div className={styles['friendListLayout']}>
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

export default FriendListLayout
