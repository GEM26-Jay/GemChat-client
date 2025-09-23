import {
  ChatMessage,
  GroupMember,
  MessageStatus,
  MessageType,
  User,
  UserFriend
} from '@shared/types'
import styles from './MessageItem.module.css'
import { useQuery } from '@tanstack/react-query'
import LocalImage from '../LocalImage'
import {
  FaFile,
  FaFileAudio,
  FaFileExcel,
  FaFileImage,
  FaFilePdf,
  FaFileVideo,
  FaFileWord,
  FaSpinner,
  FaXmark
} from 'react-icons/fa6'
import { formatFileSize, getMIMEFromFilename } from '@shared/utils'

// 根据MIME类型获取显示图标
const getIconByMIME = (mimeType: string): React.ReactNode => {
  if (mimeType.startsWith('image/')) {
    return <FaFileImage className={styles['preview-icon']} />
  }
  if (mimeType.startsWith('video/')) {
    return <FaFileVideo className={styles['preview-icon']} />
  }
  if (mimeType.startsWith('audio/')) {
    return <FaFileAudio className={styles['preview-icon']} />
  }
  switch (mimeType) {
    case 'application/pdf':
      return <FaFilePdf className={styles['preview-icon']} />
    case 'application/msword':
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return <FaFileWord className={styles['preview-icon']} />
    case 'application/vnd.ms-excel':
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      return <FaFileExcel className={styles['preview-icon']} />
    default:
      return <FaFile className={styles['preview-icon']} />
  }
}

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

  const handleOpenImage = async (name: string): Promise<void> => {
    window.fileManager.openImageViewer(name)
  }

  // 生成消息内容
  const renderContent = (): React.ReactNode => {
    if (message.type === MessageType.TYPE_TEXT) {
      return <span className={styles['content-text']}>{message.content}</span>
    }

    const [originName, remoteName, size] = message.content
      ? message.content.split(':')
      : [undefined, undefined, undefined]
    const icon = getIconByMIME(getMIMEFromFilename(originName as string))

    if (message.type === MessageType.TYPE_IMAGE) {
      console.log('renderContent:remoteName', remoteName)
      return (
        <div
          className={styles['content-image-wrapper']}
          onClick={() => {
            handleOpenImage(remoteName as string)
          }}
        >
          <LocalImage
            className={styles['content-image-show']}
            fileName={remoteName}
            option="image"
          ></LocalImage>
          <span className={styles['content-image-size']}>{formatFileSize(Number(size))}</span>
        </div>
      )
    }

    // 文件类型消息
    return (
      <div className={styles['content-file-wrapper']}>
        <div className={styles['content-icon']}>{icon}</div>
        <div>
          <span className={styles['content-file-name']}>{originName}</span>
          <span className={styles['content-file-size']}>{formatFileSize(Number(size))}</span>
        </div>
      </div>
    )
  }

  return (
    <div
      className={styles[message.fromId === userId ? 'message-item-mine' : 'message-item-others']}
    >
      <LocalImage className={styles['message-avatar']} fileName={avatarUrl}></LocalImage>
      <div className={styles['message-content']}>
        {isGroup && (
          <div className={styles['message-userName']}>
            <span> {name} </span>
          </div>
        )}

        {message.status === MessageStatus.TYPE_SENDING && (
          <FaSpinner className={styles['message-sending']}></FaSpinner>
        )}
        {message.status === MessageStatus.TYPE_FAILED && (
          <FaXmark className={styles['message-failed']}></FaXmark>
        )}

        {/* 文本消息使用气泡框，文件和图片消息使用媒体容器（无气泡） */}
        {message.type === MessageType.TYPE_TEXT ? (
          <div className={styles['message-bubble']}>
            <div className={styles['content-container']}>{renderContent()}</div>
          </div>
        ) : (
          <div className={styles['media-container']}>{renderContent()}</div>
        )}
      </div>
    </div>
  )
}

export default MessageItem
