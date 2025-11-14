import React, { useState } from 'react'
import 'modern-normalize/modern-normalize.css'
import styles from './AddSessionBoard.module.css'
import { FaCircle, FaSearch, FaTimes, FaCheckCircle } from 'react-icons/fa'
import { useQueries, useQuery } from '@tanstack/react-query'
import { ApiResult, User, UserFriend, UserFriendProfile } from '@shared/types'
import LocalImage from '../home/components/LocalImage'
import { CreateGroupDTO } from '@shared/DTO.types'

const AddSessionBoard: React.FC = () => {
  const [searchText, setSearchText] = useState('')
  // 管理已选好友（用 Set 存储 ID 确保不重复，用数组存储已选列表）
  const [selectedFriendIds, setSelectedFriendIds] = useState<Set<string>>(new Set())
  const [showWaiting, setShowWaiting] = useState(false)

  // 1. 获取好友列表（优化：增加 enabled 避免无效请求，添加 refetch 支持刷新）
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

  // 2. 批量获取好友详情（优化：用闭包保留 friendId，避免依赖 queryKey；增加 staleTime 减少请求）
  const friendQueries = useQueries({
    queries: friends.map((friend) => ({
      queryKey: ['user', friend.friendId],
      queryFn: () =>
        window.businessApi.user
          .selectById(friend.friendId)
          .then((apiResult: ApiResult<User>) =>
            apiResult.isSuccess && apiResult.data ? apiResult.data : null
          )
          .catch(() => null),
      staleTime: 15 * 60 * 1000, // 15分钟缓存，减少重复请求
      enabled: !!friends.length // 好友列表为空时不请求
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

  // 4. 搜索筛选（优化：trim 去空、提前处理小写，提升性能）
  const filteredFriends = React.useMemo(() => {
    if (!searchText.trim()) return friendProfiles

    const lowerSearchText = searchText.toLowerCase()
    return friendProfiles.filter((item) => {
      const usernameMatch = item.username.toLowerCase().includes(lowerSearchText)
      const remarkMatch = item.remark?.toLowerCase().includes(lowerSearchText) ?? false
      const phoneMatch = item.maskedPhone?.includes(lowerSearchText) ?? false
      const emailMatch = item.maskedEmail?.toLowerCase().includes(lowerSearchText) ?? false
      return usernameMatch || remarkMatch || phoneMatch || emailMatch
    })
  }, [searchText, friendProfiles]) // 依赖变化才重新计算

  // 5. 已选好友列表（从所有好友中筛选已选ID）
  const selectedFriends = React.useMemo(() => {
    return friendProfiles.filter((friend) => selectedFriendIds.has(friend.id))
  }, [selectedFriendIds, friendProfiles])

  // 6. 选择/取消选择好友（避免直接修改 Set，确保不可变）
  const toggleFriendSelection = (friendId: string): void => {
    setSelectedFriendIds((prev) => {
      const newSet = new Set(prev)
      newSet.has(friendId) ? newSet.delete(friendId) : newSet.add(friendId)
      return newSet
    })
  }

  // 7. 清空已选
  const clearSelected = (): void => {
    setSelectedFriendIds(new Set())
  }

  // 8. 处理搜索输入（修复原代码：e.target 应为 e.target.value）
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setSearchText(e.target.value)
  }

  // 9. 清空搜索框
  const clearSearchText = (): void => {
    setSearchText('')
  }

  // 10. 创建群聊/单聊，聊天会话
  const handleAddSession = async (): Promise<void> => {
    // 创建弹窗，提醒用户等待
    setShowWaiting(true)
    if (selectedFriends.length === 1) {
      const user = (await window.clientData.get('user')) as User
      const apiResult = await window.businessApi.chat.getSingleSessionByUserIds(
        selectedFriends[0].id,
        user.id
      )
      console.log(apiResult)
      if (apiResult.isSuccess && apiResult.data) {
        const path = `/home/chat/${apiResult.data.id}`
        console.log(path)
        window.windowsApi.navigateMainWindow(path)
        window.windowsApi.closeAddSessionWindow()
      } else {
        alert('发生异常!无法找到会话')
      }
    } else {
      let fullName = selectedFriends.map((item) => item.username).join(',')
      const user = (await window.clientData.get("user")) as User
      
      fullName = user.username + "," + fullName
      const groupName = fullName.length > 50 ? `${fullName.slice(0, 50)}...` : fullName

      const apiResult = await window.businessApi.chat.createGroup({
        groupName: groupName,
        userIds: selectedFriends.map((item) => item.id)
      } as CreateGroupDTO)
      let isSuccess = false
      if (apiResult.isSuccess && apiResult.data) {
        let i = 4
        while (i > 0) {
          const result = await window.businessApi.chat.getGroupSessionByGroupId(apiResult.data.id)
          console.log(result)
          if (result.isSuccess && result.data) {
            isSuccess = true
            await window.windowsApi.navigateMainWindow(`/home/chat/${result.data.id}`)
            await window.windowsApi.closeAddSessionWindow()
            break
          }
          await new Promise((resolve) => setTimeout(resolve, 1000)) // 等待1秒
          i--
        }
      }
      if (!isSuccess) {
        alert('创建会话失败')
      }
      setShowWaiting(false)
    }
  }

  // 左侧面板：搜索+好友列表
  const leftPanel = (
    <>
      {/* 头部：搜索栏 */}
      <div className={styles['panel-header']}>
        <div className={styles['search-container']}>
          <FaSearch className={styles['search-icon']} />
          <input
            type="text"
            className={styles['search-input']}
            placeholder="搜索好友（名称/备注/手机号）"
            value={searchText}
            onChange={handleSearchChange}
          />
          {/* 有搜索内容时显示清空按钮 */}
          {searchText.trim() && (
            <FaTimes
              className={styles['clear-search-icon']}
              onClick={clearSearchText}
              aria-label="清空搜索"
            />
          )}
        </div>
      </div>

      {/* 好友列表（处理空状态、加载状态） */}
      <div className={styles['list-container']}>
        {friendQueries.some((q) => q.isLoading) ? (
          // 加载中状态
          <div className={styles['loading-state']}>
            <FaCircle className={styles['loading-spinner']} />
            <span>加载好友列表中...</span>
          </div>
        ) : filteredFriends.length === 0 ? (
          // 空状态
          <div className={styles['empty-state']}>
            <span>未找到匹配的好友</span>
          </div>
        ) : (
          <ul className={styles['friend-list']}>
            {filteredFriends.map((friend) => (
              <li
                key={`friend-${friend.id}`}
                className={`${styles['friend-item']} ${
                  selectedFriendIds.has(friend.id) ? styles['friend-item--selected'] : ''
                }`}
                onClick={() => toggleFriendSelection(friend.id)}
                role="button"
                tabIndex={0}
                aria-selected={selectedFriendIds.has(friend.id)}
              >
                {/* 头像 */}
                <div className={styles['friend-avatar-wrapper']}>
                  <LocalImage
                    fileName={friend.avatar}
                    alt={friend.remark || friend.username}
                    className={styles['friend-avatar']}
                  />
                  {/* 选中状态图标 */}
                  {selectedFriendIds.has(friend.id) && (
                    <FaCheckCircle className={styles['selected-icon']} />
                  )}
                </div>
                {/* 名称+备注 */}
                <div className={styles['friend-info']}>
                  <div className={styles['friend-name']}>{friend.remark || friend.username}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )

  // 右侧面板：已选好友+操作按钮
  const rightPanel = (
    <>
      {/* 头部：标题+清空按钮 */}
      <div className={styles['panel-header']}>
        <span className={styles['panel-title']}>发起聊天（{selectedFriends.length}人）</span>
        {selectedFriends.length > 0 && (
          <button
            className={styles['clear-selected-btn']}
            onClick={clearSelected}
            aria-label="清空已选"
          >
            清空
          </button>
        )}
      </div>

      {/* 已选好友列表（处理空状态） */}
      <div className={styles['list-container']}>
        {selectedFriends.length === 0 ? (
          <div className={styles['empty-state']}>
            <span>从左侧选择好友加入聊天</span>
          </div>
        ) : (
          <ul className={styles['selected-friend-list']}>
            {selectedFriends.map((friend) => (
              <li key={`selected-friend-${friend.id}`} className={styles['selected-friend-item']}>
                <LocalImage
                  fileName={friend.avatar}
                  alt={friend.remark || friend.username}
                  className={styles['selected-friend-avatar']}
                />
                <span className={styles['selected-friend-name']}>
                  {friend.remark || friend.username}
                </span>
                {/* 取消选择按钮 */}
                <button
                  className={styles['remove-selected-btn']}
                  onClick={(e) => {
                    e.stopPropagation() // 阻止冒泡到li
                    toggleFriendSelection(friend.id)
                  }}
                  aria-label={`移除${friend.remark || friend.username}`}
                >
                  <FaTimes />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 底部操作按钮 */}
      <div className={styles['action-buttons']}>
        <button
          className={styles['cancel-btn']}
          onClick={() => {
            // 取消逻辑：如关闭面板
            window.windowsApi.closeAddSessionWindow()
          }}
        >
          取消
        </button>
        <button
          className={styles['confirm-btn']}
          onClick={() => {
            handleAddSession()
          }}
          disabled={selectedFriends.length === 0} // 无选中时禁用
        >
          完成
        </button>
      </div>
    </>
  )

  return (
    <div className={styles['add-session-board']}>
      <div className={styles['left-pannel']}>{leftPanel}</div>
      <div className={styles['right-pannel']}>{rightPanel}</div>
      {showWaiting && (
        <div className={styles['show-waiting']}>
          <span>正在创建会话，请等待...</span>
        </div>
      )}
    </div>
  )
}

export default AddSessionBoard
