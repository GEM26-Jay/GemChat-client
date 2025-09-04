import { ChatMessage, GroupMember, User, UserFriend } from '@shared/types'
import styles from './MessageItem.module.css'
import { useQuery } from '@tanstack/react-query'

interface MessageItemProps {
  userId: string
  isGroup: boolean
  message: ChatMessage
}

const MessageItem: React.FC<MessageItemProps> = ({
  userId,
  isGroup,
  message
}: MessageItemProps) => {
  const { data: user } = useQuery<User | null>({
    queryKey: ['user', message.fromId],
    queryFn: () =>
      window.businessApi.user
        .selectById(message.fromId)
        .then((apiResult) => (apiResult.isSuccess && apiResult.data ? apiResult.data : null))
        .catch(() => null)
  })

  const { data: userFriend } = useQuery<UserFriend | null>({
    queryKey: ['user_friend', userId, message.fromId],
    queryFn: () =>
      window.businessApi.friend
        .getByTargetId(message.fromId)
        .then((apiResult) => (apiResult.isSuccess && apiResult.data ? apiResult.data : null))
        .catch(() => null),
    enabled: isGroup
  })

  const { data: groupMember } = useQuery<GroupMember | null>({
    queryKey: ['group_member', message.toId, message.fromId],
    queryFn: () =>
      window.businessApi.chat
        .getGroupMemberByGroupIdAndUserId(message.toId, message.fromId)
        .then((apiResult) => (apiResult.isSuccess && apiResult.data ? apiResult.data : null))
        .catch(() => null),
    enabled: isGroup
  })

  const avatarUrl = user?.avatar
  let name = user?.username
  if (isGroup) {
    name = groupMember?.remark ? groupMember?.remark : name
    name = userFriend && userFriend.remark ? userFriend.remark : name
  }

  return (
    <div className={styles[message.fromId == userId ? 'message-item-mine' : 'message-item-others']}>
      <img src={avatarUrl} className={styles['message-avatar']} />
      <div className={styles['message-content']}>
        {isGroup && <div className={styles['message-userName']}>{name}</div>}
        <div className={styles['message-text']}>{message.content}</div>
      </div>
    </div>
  )
}

export default MessageItem
