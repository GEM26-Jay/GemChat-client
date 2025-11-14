import { ChatMessage, MessageStatus, MessageType } from '@shared/types'
import styles from './MessageItem.module.css'
import { useQuery } from '@tanstack/react-query'
import LocalImage from '../../LocalImage'
import { FaSpinner, FaXmark } from 'react-icons/fa6'
import { User, GroupMember, UserFriend } from '@shared/types'
import TextMessageItem from './TextMessageItem'
import FileMessageItem from './file-message/FileMessageItem'

interface MessageItemProps {
  userId: string
  isGroup: boolean
  message: ChatMessage
  inOps: boolean
}

const MessageItem: React.FC<MessageItemProps> = ({
  userId,
  isGroup,
  message,
  inOps
}: MessageItemProps) => {
  // 获取发送者用户信息
  const { data: user } = useQuery<User | null>({
    queryKey: ['user', message.fromId],
    queryFn: () =>
      window.businessApi.user
        .selectById(message.fromId)
        .then((res) => (res.isSuccess && res.data ? res.data : null))
        .catch(() => null)
  })

  // 获取群成员信息
  const { data: groupMember } = useQuery<GroupMember | null>({
    queryKey: ['group_member', message.sessionId, message.fromId],
    queryFn: () =>
      window.businessApi.chat
        .getGroupMemberByGroupIdAndUserId(message.sessionId, message.fromId)
        .then((res) => (res.isSuccess && res.data ? res.data : null))
        .catch(() => null),
    enabled: isGroup
  })

  // 获取好友信息
  const { data: userFriend } = useQuery<UserFriend | null>({
    queryKey: ['user_friend', userId, message.fromId],
    queryFn: () =>
      window.businessApi.friend
        .getByTargetId(message.fromId)
        .then((res) => (res.isSuccess && res.data ? res.data : null))
        .catch(() => null),
    enabled: isGroup
  })

  // 确定显示名称
  const avatarUrl = user?.avatar
  let name = user?.username
  if (isGroup) {
    name = groupMember?.remark || userFriend?.remark || name
  }

  // 渲染消息状态图标
  const renderStatusIcon = (): React.ReactNode => {
    if (message.status === MessageStatus.TYPE_SENDING) {
      return <FaSpinner className={styles['message-sending']} />
    }
    if (message.status === MessageStatus.TYPE_FAILED) {
      return <FaXmark className={styles['message-failed']} />
    }
    return null
  }

  const isMine = message.fromId === userId
  // 渲染具体消息内容
  const renderMessageContent = (): React.ReactNode => {
    switch (message.type) {
      case MessageType.TEXT:
        return <TextMessageItem content={message.content} isMine={isMine} />
      case MessageType.IMAGE:
      case MessageType.VIDEO:
      case MessageType.OTHER_FILE:
        return <FileMessageItem message={message} isMine={isMine} inOps={inOps} />
      default:
        return null
    }
  }

  return (
    <div
      className={styles[message.fromId === userId ? 'message-item-mine' : 'message-item-others']}
    >
      <LocalImage className={styles['message-avatar']} fileName={avatarUrl} />
      <div className={styles['message-content']}>
        {isGroup && message.fromId != userId && (
          <div className={styles['message-userName']}>
            <span> {name} </span>
          </div>
        )}

        {renderStatusIcon()}
        {renderMessageContent()}
      </div>
    </div>
  )
}

export default MessageItem
