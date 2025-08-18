// types.ts
export interface ChatListItemType {
  id: string // 聊天会话唯一标识
  avatar: string // 头像图片地址
  title: string // 聊天对象标题（群名称、联系人名称等）
  lastMessage: string // 最后一条消息内容
  time: string // 消息时间
  unreadCount?: number // 未读消息数量（可选）
  isGroup?: boolean
}
