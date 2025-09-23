import React, { useMemo } from 'react'
import { FaEllipsisH } from 'react-icons/fa'
import MessageBox from '../message-box/MessageBox'
import styles from './ChatBoxLayout.module.css'
import VerticalSplitPanel from '../split-panel/VerticalSplitPanel'
import { useParams } from 'react-router'
import SendBox from '../send-box/SendBox'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ApiResult,
  ChatSession,
  ChatGroup,
  User,
  UserFriend,
  MessageType,
  ChatMessage,
  UniversalFile,
  MessageStatus,
  FileMap
} from '@shared/types'
import { useDispatch } from 'react-redux'
import { setMessageCursor } from '../../store/messageCursor'

const ChatBoxLayout: React.FC = () => {
  const { sessionId } = useParams<string>()
  const queryKey = useMemo(() => ['chat_message', sessionId], [sessionId])
  const queryClient = useQueryClient()
  const dispatch = useDispatch()

  const { data: user } = useQuery<User | null>({
    queryKey: ['current_user'],
    queryFn: () =>
      (window.clientData.get('user') as Promise<User>)
        .then((user: User) => (user ? user : null))
        .catch(() => null),
    staleTime: 30 * 60 * 1000,
    enabled: !!sessionId
  })

  const { data: chatSession } = useQuery<ChatSession | null>({
    queryKey: ['chat_session', sessionId],
    queryFn: () =>
      window.businessApi.chat
        .getSessionById(sessionId as string)
        .then((apiResult: ApiResult<ChatSession>) =>
          apiResult.isSuccess && apiResult.data ? apiResult.data : null
        )
        .catch(() => null),
    staleTime: 30 * 60 * 1000,
    enabled: !!sessionId
  })

  let isValid = true

  let isGroup = false
  let targetUserId = ''
  if (chatSession && user) {
    isGroup = chatSession.type === 1 ? false : true
    targetUserId = !isGroup
      ? user.id === chatSession.secondId
        ? (chatSession.firstId as string)
        : (chatSession.secondId as string)
      : ''
  } else {
    isValid = false
  }

  const { data: targetUser } = useQuery<User | null>({
    queryKey: ['user', targetUserId],
    queryFn: () =>
      window.businessApi.user
        .selectById(targetUserId)
        .then((apiResult: ApiResult<User>) =>
          apiResult.isSuccess && apiResult.data ? apiResult.data : null
        )
        .catch(() => null),
    staleTime: 30 * 60 * 1000,
    enabled: !isGroup && isValid
  })

  const { data: group } = useQuery<ChatGroup | null>({
    queryKey: ['group', chatSession?.firstId],
    queryFn: () =>
      window.businessApi.chat
        .getGroupById(chatSession?.firstId as string)
        .then((apiResult: ApiResult<ChatGroup>) =>
          apiResult.isSuccess && apiResult.data ? apiResult.data : null
        )
        .catch(() => null),
    staleTime: 30 * 60 * 1000,
    enabled: isGroup && isValid
  })

  // 获取好友
  const { data: userFriend } = useQuery<UserFriend | null>({
    queryKey: ['user_friend', targetUserId],
    queryFn: () =>
      window.businessApi.friend
        .getByTargetId(targetUserId)
        .then((apiResult: ApiResult<UserFriend>) =>
          apiResult.isSuccess && apiResult.data ? apiResult.data : null
        )
        .catch(() => null),
    staleTime: 30 * 60 * 1000,
    enabled: !group && isValid
  })

  if (!isValid) {
    return null
  }

  const findTempMessageIndex = (queryKey: unknown[], tempMessage: ChatMessage): number => {
    const messages = queryClient.getQueryData<ChatMessage[]>(queryKey) || []
    return messages.findIndex(
      (item) =>
        item.createdAt === tempMessage.createdAt &&
        item.sessionId === tempMessage.sessionId &&
        (item.messageId.startsWith('temp') || item.messageId === tempMessage.messageId)
    )
  }

  const updateTempMessageToFailed = (queryKey: unknown[], tempMessage: ChatMessage): void => {
    const messageIndex = findTempMessageIndex(queryKey, tempMessage)
    if (messageIndex === -1) return // 未找到临时消息，直接返回

    // 严格遵循不可变性：用map生成新数组（不修改原数据）
    const messages = queryClient.getQueryData<ChatMessage[]>(queryKey) || []
    const newMessages = messages.map((item, index) =>
      index === messageIndex ? { ...item, status: MessageStatus.TYPE_FAILED } : item
    )
    queryClient.setQueryData(queryKey, newMessages)
  }

  const handleSendMessage = async (sessionId: string, content: string): Promise<void> => {
    if (!user?.id) {
      console.error('用户未登录，无法发送消息')
      return
    }

    // 校验内容非空（避免发送空消息）
    if (!content.trim()) {
      return
    }

    // 获取当前消息列表
    const currentMessages = (queryClient.getQueryData(queryKey) as ChatMessage[]) || []

    // 乐观更新：先在UI上显示"发送中"的消息
    try {
      // 调用接口发送消息
      const apiResult = await window.businessApi.chat.sendMessage(
        sessionId,
        MessageType.TYPE_TEXT,
        content
      )

      const message = apiResult.data as ChatMessage
      queryClient.setQueryData(queryKey, [...currentMessages, message])
      dispatch(setMessageCursor({ key: sessionId, messageId: message.messageId }))

      console.log(queryClient.getQueryData(queryKey))
    } catch (error) {
      console.error('发送消息失败:', error)
      alert('消息发送失败')
    }
  }

  const handleSendFile = async (sessionId: string, file: UniversalFile): Promise<void> => {
    if (!user?.id) {
      console.error('用户未登录，无法发送消息')
      return
    }
    // 获取当前消息列表
    const currentMessages = (queryClient.getQueryData(queryKey) as ChatMessage[]) || []
    // 乐观更新：先在UI上显示"发送中"的消息
    const type = file.mimeType.startsWith('image') ? MessageType.TYPE_IMAGE : MessageType.TYPE_FILE
    const time = Date.now()
    const tempMessage: ChatMessage = {
      id: 0,
      sessionId,
      messageId: `temp-${time}`,
      type: type,
      fromId: user.id,
      toId: sessionId,
      content: file.fileName,
      status: MessageStatus.TYPE_SENDING,
      createdAt: time,
      updatedAt: time
    }
    queryClient.setQueryData(queryKey, [...currentMessages, tempMessage])
    dispatch(setMessageCursor({ key: sessionId, messageId: tempMessage.messageId }))

    try {
      // 步骤1：上传文件（await扁平化异步，避免嵌套）
      const fileApiResult = await window.fileManager.uploadUserFile(file)

      // 步骤2：上传成功，构造新文件名并发送消息
      if (fileApiResult.isSuccess && fileApiResult.data) {
        const newFile = fileApiResult.data as UniversalFile
        const sendName = file.fileName + ':' + newFile.fileName + ':' + newFile.fileSize
        await window.businessApi.chat
          .sendMessage(sessionId, type, sendName, time)
          .then((apiResult) => {
            if (apiResult.isSuccess && apiResult.data) {
              const msg = apiResult.data as ChatMessage
              window.businessApi.file.add({
                originName: file.fileName,
                remoteName: newFile.fileName,
                fingerprint: newFile.fingerprint,
                size: newFile.fileSize,
                mimeType: newFile.mimeType,
                location: newFile.localPath,
                status: 1,
                createdAt: time,
                updatedAt: time,
                sessionId: msg.sessionId,
                messageId: 'temp',
                sourceInfo: isGroup
                  ? 'group:' + group?.id + ':' + user.id
                  : 'single:' + userFriend?.id + ':' + user.id
              } as FileMap)
            } else {
              updateTempMessageToFailed(queryKey, tempMessage)
              console.warn('消息发送失败')
            }
          })
      } else {
        // 步骤3：上传失败（返回isSuccess=false），更新临时消息状态
        updateTempMessageToFailed(queryKey, tempMessage)
        console.warn('文件上传失败（业务层）:', fileApiResult.msg)
      }
    } catch (error) {
      // 步骤4：捕获所有异常（上传失败、发送消息失败、网络错误等）
      console.error('发送文件消息失败:', error)
      updateTempMessageToFailed(queryKey, tempMessage) // 统一失败处理
      alert('消息发送失败，请稍后重试')
    } finally {
      // （可选）无论成功/失败，都需要执行的逻辑（如打印日志、清理临时数据）
      console.log('文件消息处理完成，当前消息列表:', queryClient.getQueryData(queryKey))
    }
  }

  const title = isGroup
    ? group?.name
    : userFriend?.remark
      ? userFriend?.remark
      : targetUser?.username

  const topPanel = (
    <div className={styles['topPanel']}>
      <MessageBox
        isGroup={isGroup}
        userId={user?.id as string}
        sessionId={chatSession?.id as string}
      ></MessageBox>
    </div>
  )

  const bottomPanel = (
    <div className={styles['bottomPanel']}>
      <SendBox
        sessionId={sessionId as string}
        handleSendText={handleSendMessage}
        handleSendFile={handleSendFile}
      ></SendBox>
    </div>
  )

  return (
    <div className={styles['chat-box-container']}>
      {/* 顶部标题栏 */}
      <div className={styles['chat-header']}>
        <span className={styles['chat-header-name']}>{title}</span>
        <FaEllipsisH className={styles['chat-setting-icon']} />
      </div>
      <div className={styles['main-chat-panel']}>
        <VerticalSplitPanel
          panelKey="message & send"
          topPanel={topPanel}
          bottomPanel={bottomPanel}
          minTopRatio={0.4}
          maxTopRatio={0.8}
          initTopRatio={0.65}
        ></VerticalSplitPanel>
      </div>
    </div>
  )
}

export default ChatBoxLayout
