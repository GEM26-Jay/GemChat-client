import { useQuery } from '@tanstack/react-query'
import styles from './FriendBlockBox.module.css'
import { ApiResult, User, UserFriend } from '@shared/types'
import LocalImage from '../LocalImage'

// 提取获取用户的查询函数
const fetchUserById = async (userId: string): Promise<User | undefined> => {
  const result: ApiResult<User> = await window.businessApi.user.selectById(userId)
  return result.isSuccess ? result.data : undefined
}

interface FriendRequestItemProps {
  item: UserFriend
}

// 单个黑名单项组件
const FriendBlockItem: React.FC<FriendRequestItemProps> = ({ item }: FriendRequestItemProps) => {
  const { data: user } = useQuery({
    queryKey: ['user', item.friendId],
    queryFn: () => fetchUserById(item.friendId),
    enabled: !!item.friendId
  })

  const handleUnblock = async (item: UserFriend): Promise<void> => {
    const itemCopy = { ...item, blockStatus: 0 } as UserFriend
    const apiResult = await window.businessApi.friend.updateFriendBlock(itemCopy)

    if (!apiResult.isSuccess) {
      throw new Error(apiResult.msg)
    }
  }

  if (!user) return null

  return (
    <li className={styles.listItem}>
      <div className={styles.avatarContainer}>
        <LocalImage className={styles.avatar} fileName={user.avatar} alt={user.username} />
      </div>

      <div className={styles.content}>
        <div className={styles.nameRow}>
          <span className={styles.name}>{user.username}</span>
          {item.remark && <span className={styles.remark}>({item.remark})</span>}
        </div>
        <p className={styles.signature}>{user.signature || '暂无签名'}</p>
      </div>

      <button
        className={styles.unblockButton}
        onClick={() => {
          handleUnblock(item)
        }}
        aria-label={`取消拉黑 ${user.username}`}
      >
        取消拉黑
      </button>
    </li>
  )
}

const FriendBlockBox: React.FC = () => {
  const { data: blockList = [] } = useQuery({
    queryKey: ['user_friend', 'block_list'],
    queryFn: async () => {
      const result: ApiResult<UserFriend[]> = await window.businessApi.friend.getBlacklist()
      return result.isSuccess ? result.data : []
    },
    staleTime: 1000 * 60 * 5 // 5分钟缓存
  })

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h2 className={styles.title}>黑名单</h2>
        <span className={styles.count}>{blockList.length}人</span>
      </header>

      {blockList.length === 0 ? (
        <div className={styles.emptyState}>
          <p>暂无好友被拉黑</p>
        </div>
      ) : (
        <ul className={styles.list}>
          {blockList.map((item) => (
            <FriendBlockItem key={item.id} item={item} />
          ))}
        </ul>
      )}
    </div>
  )
}

export default FriendBlockBox
