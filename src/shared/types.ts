import { MIME } from './utils'

/** 统一API返回格式 */
export interface ApiResult<T = void> {
  isSuccess: boolean
  data?: T
  msg?: string
  errType?: 'business' | 'http'
}

// 消息类型枚举（保持与后端对齐）
export enum MessageType {
  TYPE_TEXT = 1,
  TYPE_IMAGE = 2,
  TYPE_FILE = 3,
  TYPE_VOICE = 4,
  TYPE_VIDEO = 5,
  TYPE_LOCATION = 6,
  TYPE_CUSTOM = 99
}

// 消息类型枚举（保持与后端对齐）
export enum MessageStatus {
  TYPE_SENDING = 1,
  TYPE_FAILED = 2,
  TYPE_SUCCESS = 3,
  TYPE_DRAWBACK = 4,
  TYPE_DELETED = 5,
  TYPE_READ = 6
}

/** 用户资料类型（对应user_profile表） */
export type User = {
  id: string // 用户唯一标识
  username: string // 用户名
  maskedEmail?: string // 脱敏邮箱
  maskedPhone?: string // 脱敏手机号
  avatar: string // 头像URL
  signature: string // 个性签名
  gender: number // 性别（0-未知，1-男，2-女）
  birthdate: string // 出生日期（yyyy-MM-dd）
  status: number // 状态（0-禁用，1-正常，2-冻结）
  createdAt: number // 注册时间戳（毫秒）
  updatedAt: number // 最后更新时间戳（毫秒）
}

/** 注册表单数据类型 */
export type RegisterData = {
  username: string
  avatar: string
  password: string
  confirmPassword?: string
  email: string
  phone: string
  signature: string
  gender: '0' | '1' | '2' // 0-未知, 1-男, 2-女
  birthdate: string // 出生日期字符串（yyyy-MM-dd）
}

/** 登录表单数据类型（对应local_account表） */
export interface LoginFormData {
  account: string
  password: string
  avatar?: string
  isAgree?: boolean
  isLogin?: boolean
  isShow?: boolean
}

/** OSS临时授权Token类型 */
export interface FileToken {
  exist: boolean
  // 文件信息
  name: string // 文件名称
  path: string // 桶内路径
  size: number // 文件大小
  // OSS 信息
  region: string
  bucket: string
  // OSS 密钥
  accessKeyId: string
  accessKeySecret: string
  securityToken: string
  expiration: string
  // 完整HTTP访问路径
  httpAccessPath: string
}

// MIME类型与目标内容格式的映射表（key：MIME类型/通配符，value：对应内容格式）
export type MimeContentTypeMap = {
  [key in MIME | `${string}/*`]?: null | 'Base64' | 'Text' | 'ArrayBuffer'
}

/** 通用文件类型 */
export interface UniversalFile {
  fileId?: string // 文件唯一标识
  fileName: string // 文件名（含扩展名）
  mimeType: MIME // 文件MIME类型
  fileSize: number // 文件大小（字节）
  contentType: null | 'Base64' | 'Text' | 'ArrayBuffer' // 内容格式
  content?: string | ArrayBuffer // 文件内容
  localPath?: string // 本地文件路径
  fingerprint?: string // 文件指纹
}

/** 群聊信息类型（对应group表） */
export interface ChatGroup {
  id: string // 群聊ID
  name: string // 群聊名称
  createUser: number // 创建者用户ID
  avatar: string // 群头像URL
  signature: string // 群描述
  number: number // 成员数量
  status: number // 状态（0-正常，1-删除，2-禁用）
  createdAt: number // 创建时间戳（毫秒）
  updatedAt: number // 更新时间戳（毫秒）
}

/** 群成员关联类型（对应group_member表） */
export interface GroupMember {
  groupId: string // 群聊ID
  userId: string // 成员用户ID
  remark?: string // 群内备注
  status: number // 状态（0-正常，1-禁用，2-删除）
  role: number // 角色（1-群主，2-管理员，3-普通成员）
  createdAt: number // 加入时间戳（毫秒）
  updatedAt: number // 更新时间戳（毫秒）
}

/** 好友申请类型（对应friend_request表） */
export interface FriendRequest {
  id: string // 申请ID
  fromId: string // 申请人ID
  toId: string // 被申请人ID
  fromRemark?: string // 申请人备注
  toRemark?: string // 被申请人备注
  statement?: string // 申请留言
  status?: number // 状态（0-待处理，1-已通过，2-已拒绝）
  createdAt?: number // 申请时间戳（毫秒）
  updatedAt?: number // 更新时间戳（毫秒）
}

/** 好友类型（对应user_friend表） */
export interface UserFriend {
  id: string
  userId: string
  friendId: string
  blockStatus: number
  deleteStatus: number
  remark: string
  createdAt: number // 申请时间戳（毫秒）
  updatedAt: number // 更新时间戳（毫秒）
}

export interface UserFriendProfile extends User {
  remark: string
}

/**
 * 聊天会话类型
 */
export interface ChatSession {
  id: string // 会话ID，主键
  type: number // 聊天类型 1-单聊，2-群聊
  firstId: string | null // 如果是单聊，则为第二个用户的ID，如果是群聊，则为空
  secondId: string | null // 如果是单聊，则为第二个用户的ID，如果是群聊，则为空
  status: number // 1-正常
  createdAt: number // 创建时间戳
  updatedAt: number // 更新时间戳
  lastMessageId: string | null // 最后一条消息ID
  lastMessageContent: string | null // 最后一条消息内容摘要
  lastMessageTime: number | null // 最后一条消息时间戳
}

/**
 * 聊天消息类型
 */
export interface ChatMessage {
  id: number // 主键
  sessionId: string // 会话ID
  messageId: string
  type: number
  fromId: string // 发送者ID
  toId: string // 接收者ID（用户ID或群ID）
  content: string | null // 消息内容
  status: number
  replyToId?: string | null // 引用消息ID（回复功能）
  createdAt: number // 发送时间戳
  updatedAt: number // 更新时间戳
}

/**
 * 文件映射业务对象类型
 */
export interface FileMap {
  id?: number
  originName: string
  remoteName: string
  fingerprint: string
  size: number
  mimeType: string
  location: string
  status: number // 0:未下载, 1: 已下载
  createdAt: number
  updatedAt: number
  sessionId: string
  messageId: string
  sourceInfo: string
}
