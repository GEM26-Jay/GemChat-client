import { useQuery, useQueries } from '@tanstack/react-query'
import styles from './FriendRequestBox.module.css'
import { ApiResult, FriendRequest, User } from '@shared/types'
import LocalImage from '../LocalImage'

// 提取获取用户的查询函数
const fetchUserById = async (userId: string): Promise<User | undefined> => {
  try {
    const result: ApiResult<User> = await window.businessApi.user.selectById(userId)
    return result.isSuccess ? result.data : undefined
  } catch (error) {
    console.error('获取用户失败:', error)
    return undefined
  }
}

// 提取获取当前用户的函数
const fetchCurrentUser = async (): Promise<User | undefined> => {
  try {
    const user = await window.clientData.get('user')
    return user as User
  } catch (error) {
    console.error('获取当前用户失败:', error)
    return undefined
  }
}

interface FriendRequestItemProps {
  item: FriendRequest
  user?: User
  isLoading?: boolean
  error?: Error
  currentUser: User
  onAccept: (request: FriendRequest) => Promise<void>
  onReject: (request: FriendRequest) => Promise<void>
}

// 单个申请项组件
const FriendRequestItem: React.FC<FriendRequestItemProps> = ({
  item,
  user,
  isLoading,
  error,
  currentUser,
  onAccept,
  onReject
}: FriendRequestItemProps) => {
  // 确定申请状态文本和处理状态
  const isSentByMe = currentUser.id === item.fromId
  let statusText = ''
  let needDeal = false

  switch (item.status) {
    case 0:
      statusText = isSentByMe ? '正在申请' : '等待处理'
      needDeal = !isSentByMe
      break
    case 1:
      statusText = '已通过'
      break
    case 2:
      statusText = isSentByMe ? '被拒绝' : '已拒绝'
      break
    default:
      statusText = '未知状态'
  }

  if (isLoading) {
    return (
      <li className={styles['BoxList-li']}>
        <div className={styles['loading-skeleton']}>加载中...</div>
      </li>
    )
  }

  if (error || !user) {
    return (
      <li className={styles['BoxList-li']}>
        <div className={styles['error-message']}>加载用户信息失败</div>
      </li>
    )
  }

  return (
    <li className={styles['BoxList-li']}>
      <LocalImage
        className={styles['BoxList-li-avatar']}
        fileName={user.avatar}
        alt={user.username}
      />
      <div className={styles['BoxList-li-content']}>
        <span className={styles['BoxList-li-name']}>{user.username}</span>
        <span className={styles['BoxList-li-statement']}>{item.statement}</span>
      </div>
      <div className={styles['BoxList-li-right']}>
        <span className={styles['BoxList-li-time']}>
          {item.updatedAt && new Date(item.updatedAt).toLocaleString()}
        </span>
        {needDeal ? (
          <div className={styles['BoxList-li-button']}>
            <button className={styles['BoxList-li-passedBtn']} onClick={() => onAccept(item)}>
              通过
            </button>
            <button className={styles['BoxList-li-refuseBtn']} onClick={() => onReject(item)}>
              拒绝
            </button>
          </div>
        ) : (
          <span className={styles['BoxList-li-status']}>{statusText}</span>
        )}
      </div>
    </li>
  )
}

const FriendRequestBox: React.FC = () => {
  // 获取当前用户
  const { data: currentUser, isLoading: isCurrentUserLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: fetchCurrentUser
  })

  // 获取好友申请列表
  const { data: requestList = [], isLoading: isRequestListLoading } = useQuery({
    queryKey: ['friend_request'],
    queryFn: async () => {
      const result: ApiResult<FriendRequest[]> = await window.businessApi.friend.getRequests()
      return result.isSuccess ? result.data : []
    }
  })

  // 批量查询相关用户信息
  const userQueries = useQueries({
    queries: requestList.map((request) => ({
      queryKey: ['user', currentUser?.id === request.fromId ? request.toId : request.fromId],
      queryFn: () =>
        fetchUserById(currentUser?.id === request.fromId ? request.toId : request.fromId),
      enabled: !!currentUser // 只有当前用户加载完成后才执行查询
    }))
  })

  // 处理通过申请
  const handleAccept = async (request: FriendRequest): Promise<void> => {
    request.status = 1
    await window.businessApi.friend.updateRequest(request)
  }

  // 处理拒绝申请
  const handleReject = async (request: FriendRequest): Promise<void> => {
    request.status = 2
    await window.businessApi.friend.updateRequest(request)
  }

  if (isCurrentUserLoading) {
    return <div className={styles.loading}>加载用户信息中...</div>
  }

  if (!currentUser) {
    return <div className={styles.error}>获取用户信息失败</div>
  }

  return (
    <div className={styles['FriendRequestBoxLayout']}>
      <div className={styles['FriendRequestBoxListHeader']}>
        <span>好友申请</span>
      </div>

      {isRequestListLoading ? (
        <div className={styles.loading}>加载申请列表中...</div>
      ) : requestList.length === 0 ? (
        <div className={styles['no-requests']}>暂无好友申请</div>
      ) : (
        <ul className={styles['FriendRequestBoxList']}>
          {requestList.map((item, index) => (
            <FriendRequestItem
              key={item.id}
              item={item}
              currentUser={currentUser}
              user={userQueries[index].data}
              isLoading={userQueries[index].isLoading}
              onAccept={handleAccept}
              onReject={handleReject}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

export default FriendRequestBox
