import { Database } from 'sqlite'
import { getDb } from './database'
import { ChatMessage, ChatSession } from '@shared/types'

/**
 * 数据库行记录类型（与表结构对应）- 所有ID统一为string类型
 */
export interface ChatSessionRow {
  id: string // 改为string
  type: number
  first_id: string // 改为string（用户ID/群组ID）
  second_id: string | null // 改为string（用户ID）
  last_message_id: string | null // 改为string（消息ID）
  last_message_content: string | null
  last_message_time: number | null
  status: number
  created_at: number
  updated_at: number
}
export interface ChatMessageRow {
  id: string // 改为string
  session_id: string // 改为string（会话ID）
  type: number
  from_id: string // 改为string（用户ID）
  to_id: string // 改为string（用户ID/群组ID）
  content: string | null
  status: number
  reply_to_id: string | null // 改为string（消息ID）
  created_at: number
  updated_at: number
}

/**
 * 消息类型常量
 */
export const ChatMessageType = {
  TEXT: 1 as const, // 文本消息
  IMAGE: 2 as const, // 图片消息
  FILE: 3 as const, // 文件消息
  VOICE: 4 as const, // 语音消息
  VIDEO: 5 as const, // 视频消息
  LOCATION: 6 as const, // 位置消息
  CUSTOM: 99 as const // 自定义消息
}

/**
 * 消息状态常量
 */
export const ChatMessageStatus = {
  SENDING: 0 as const, // 发送中
  SENT: 1 as const, // 已发送
  DELIVERED: 2 as const, // 已送达
  READ: 3 as const, // 已读
  FAILED: 4 as const, // 发送失败
  DRAWBACK: 5 as const, // 已撤回
  DELETED: 6 as const // 已删除
}

/**
 * 数据库行记录转换为业务对象 - 保持与Row类型一致
 */
const convertChatSessionRow2ChatSession = (data: ChatSessionRow): ChatSession => {
  return {
    id: data.id,
    type: data.type,
    firstId: data.first_id,
    secondId: data.second_id,
    lastMessageId: data.last_message_id,
    lastMessageContent: data.last_message_content,
    lastMessageTime: data.last_message_time,
    status: data.status,
    createdAt: data.created_at,
    updatedAt: data.updated_at
  }
}

const convertChatMessageRow2ChatMessage = (data: ChatMessageRow): ChatMessage => {
  return {
    id: data.id,
    sessionId: data.session_id,
    type: data.type,
    fromId: data.from_id,
    toId: data.to_id,
    content: data.content,
    status: data.status,
    replyToId: data.reply_to_id,
    createdAt: data.created_at,
    updatedAt: data.updated_at
  }
}

/**
 * 消息数据库操作类
 * 封装会话表（chat_session）和消息表（chat_message）的基础CRUD操作
 */
class ChatSessionDB {
  private dbPromise: Promise<Database>

  constructor() {
    this.dbPromise = getDb()
  }

  /**
   * 确保数据库连接可用
   */
  private async ensureDb(): Promise<Database> {
    try {
      const db = await this.dbPromise
      if (!db) throw new Error('数据库连接失败')
      return db
    } catch (error) {
      console.error('数据库连接异常:', error)
      throw error
    }
  }

  // ========================== 会话（ChatSession）相关操作 ==========================
  /**
   * 根据ID获取会话
   * @param id 会话ID（string）
   * @returns 会话对象或null（未找到）
   */
  async getSessionById(id: string): Promise<ChatSession | null> {
    const db = await this.ensureDb()
    const row = await db.get<ChatSessionRow>('SELECT * FROM chat_session WHERE id = ?', [id])
    return row ? convertChatSessionRow2ChatSession(row) : null
  }

  /**
   * 根据用户ID获取所有会话（单聊）
   * @param userId 用户ID（string）
   * @returns 会话列表（按最后消息时间倒序）
   */
  async getSingleSessionsByUserId(userId: string): Promise<ChatSession[]> {
    const db = await this.ensureDb()
    const rows = await db.all<ChatSessionRow[]>(
      `SELECT * FROM chat_session
       WHERE (first_id = ? OR second_id = ?) AND status = ? AND type = 1 
       ORDER BY updated_at DESC`,
      [userId, userId, 1]
    )
    return rows.map(convertChatSessionRow2ChatSession)
  }

  /**
   * 根据用户IDs获取指定会话（单聊）
   * @param firstId secondId 用户ID（string）
   * @returns 会话列表（按最后消息时间倒序）
   */
  async getSingleSessionByUserIds(firstId: string, secondId): Promise<ChatSession> {
    const db = await this.ensureDb()
    const row = await db.all<ChatSessionRow>(
      `SELECT * FROM chat_session
       WHERE (first_id = ? AND second_id = ? OR second_id = ? AND first_id = ?) AND status = ? AND type = 1 
       LIMIT 1`,
      [firstId, secondId, firstId, secondId, 1]
    )
    return convertChatSessionRow2ChatSession(row[0])
  }

  /**
   * 根据群组ID获取会话（群聊）
   * @param groupId 群组ID（string），type为2(群组)，first_id===groupId
   * @returns ChatSession | null（未找到返回null）
   */
  async getGroupSessionByGroupId(groupId: string): Promise<ChatSession | null> {
    const db = await this.ensureDb()
    const row = await db.get<ChatSessionRow>(
      `SELECT * FROM chat_session
       WHERE type = 2 AND first_id = ? AND status = 1`,
      [groupId]
    )
    return row ? convertChatSessionRow2ChatSession(row) : null
  }

  /**
   * 根据群组ID列表获取所有会话（群聊）
   * @param groupIds 群组ID列表（string[]）
   * @returns 会话列表（按更新时间倒序）
   */
  async getGroupSessionsByGroupIds(groupIds: string[]): Promise<ChatSession[]> {
    if (groupIds.length === 0) return []

    const db = await this.ensureDb()
    // 生成占位符（?, ?, ...）
    const placeholders = groupIds.map(() => '?').join(',')
    const rows = await db.all<ChatSessionRow[]>(
      `SELECT * FROM chat_session
       WHERE type = 2 AND first_id IN (${placeholders}) AND status = 1 
       ORDER BY updated_at DESC`,
      groupIds
    )
    return rows.map(convertChatSessionRow2ChatSession)
  }

  /**
   * 添加或更新会话信息
   * @param session 会话信息 (信息完整，所有ID为string)
   * @returns void
   */
  async addOrUpdateSession(session: ChatSession): Promise<void> {
    const db = await this.ensureDb()
    // 先查询会话是否存在
    const existingSession = await this.getSessionById(session.id)
    if (existingSession) {
      // 存在则更新
      await db.run(
        `UPDATE chat_session SET 
          type = ?, first_id = ?, second_id = ?, last_message_id = ?, 
          last_message_content = ?, last_message_time = ?, status = ?, 
          updated_at = ? 
        WHERE id = ?`,
        [
          session.type,
          session.firstId,
          session.secondId,
          session.lastMessageId,
          session.lastMessageContent,
          session.lastMessageTime,
          session.status,
          session.updatedAt,
          session.id
        ]
      )
    } else {
      // 不存在则插入
      await db.run(
        `INSERT INTO chat_session (
          id, type, first_id, second_id, last_message_id, last_message_content, 
          last_message_time, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          session.id,
          session.type,
          session.firstId,
          session.secondId,
          session.lastMessageId,
          session.lastMessageContent,
          session.lastMessageTime,
          session.status,
          session.createdAt,
          session.updatedAt
        ]
      )
    }
  }

  /**
   * 获取该用户相关的所有Session的最晚的更新时间(单聊)
   * @param userId: 用户ID（string）
   * @returns number（最晚更新时间戳，无数据返回0）
   */
  async getLatestSingleSessionUpdateAt(userId: string): Promise<number> {
    const db = await this.ensureDb()
    const result = await db.get<{ max_updated_at: number | null }>(
      `SELECT MAX(updated_at) AS max_updated_at 
       FROM chat_session
       WHERE (first_id = ? OR second_id = ?) AND type = 1 AND status = 1`,
      [userId, userId]
    )
    return result?.max_updated_at || 0
  }

  /**
   * 获取提供的群聊列表ID中的所有Session的最晚的更新时间(群聊)
   * @param groupIds: 群组ID列表（string[]）
   * @returns number（最晚更新时间戳，无数据返回0）
   */
  async getLatestGroupSessionUpdateAt(groupIds: string[]): Promise<number> {
    if (groupIds.length === 0) return 0

    const db = await this.ensureDb()
    const placeholders = groupIds.map(() => '?').join(',')
    const result = await db.get<{ max_updated_at: number | null }>(
      `SELECT MAX(updated_at) AS max_updated_at 
       FROM chat_session
       WHERE type = 2 AND first_id IN (${placeholders})`,
      groupIds
    )
    return result?.max_updated_at || 0
  }

  // ========================== 消息（ChatMessage）相关操作 ==========================
  /**
   * 根据ID获取消息
   * @param id 消息ID（string）
   * @returns 消息对象或null（未找到）
   */
  async getMessageById(id: string): Promise<ChatMessage | null> {
    const db = await this.ensureDb()
    const row = await db.get<ChatMessageRow>('SELECT * FROM chat_message WHERE id = ?', [id])
    return row ? convertChatMessageRow2ChatMessage(row) : null
  }

  /**
   * 根据会话ID获取消息列表（分页）
   * @param sessionId 会话ID（string）
   * @param page 页码（从1开始）
   * @param pageSize 每页条数
   * @returns 消息列表（按时间倒序，即最新消息在前）
   */
  async getMessagesBySessionId(
    sessionId: string,
    page: number = 1,
    pageSize: number = 30
  ): Promise<ChatMessage[]> {
    const offset = (page - 1) * pageSize
    const db = await this.ensureDb()
    const rows = await db.all<ChatMessageRow[]>(
      `SELECT * FROM chat_message
       WHERE session_id = ? AND status != ? 
       ORDER BY message_id DESC 
       LIMIT ? OFFSET ?`,
      [sessionId, ChatMessageStatus.DELETED, pageSize, offset]
    )
    return rows.map(convertChatMessageRow2ChatMessage)
  }

  /**
   * 根据会话ID获取消息列表（游标分页）
   */
  async getMessagesBySessionIdUsingCursor(
    sessionId: string,
    ltMessageId: string,
    size: number
  ): Promise<ChatMessage[]> {
    const db = await this.ensureDb()
    const rows = await db.all<ChatMessageRow[]>(
      `SELECT * FROM chat_message
       WHERE session_id = ? AND status != ? AND message_id < ?
       ORDER BY message_id DESC
       LIMIT ?`,
      [sessionId, ChatMessageStatus.DELETED, ltMessageId, size]
    )
    return rows.map(convertChatMessageRow2ChatMessage)
  }

  /**
   * 添加或更新消息
   * @param message 消息信息（数据完整，所有ID为string）
   * @returns void
   */
  async addOrUpdateMessage(message: ChatMessage): Promise<void> {
    const db = await this.ensureDb()
    // 先查询消息是否存在
    const existingMessage = await this.getMessageById(message.id)

    if (existingMessage) {
      // 存在则更新
      await db.run(
        `UPDATE chat_message SET 
          session_id = ?, type = ?, from_id = ?, to_id = ?, content = ?, 
          status = ?, reply_to_id = ?, updated_at = ? 
        WHERE id = ?`,
        [
          message.sessionId,
          message.type,
          message.fromId,
          message.toId,
          message.content,
          message.status,
          message.replyToId,
          message.updatedAt,
          message.id
        ]
      )
    } else {
      // 不存在则插入
      await db.run(
        `INSERT INTO chat_message (
          id, session_id, type, from_id, to_id, content, status, 
          reply_to_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          message.id,
          message.sessionId,
          message.type,
          message.fromId,
          message.toId,
          message.content,
          message.status,
          message.replyToId,
          message.createdAt,
          message.updatedAt
        ]
      )
    }
  }

  /**
   * 删除消息（逻辑删除，更新status为6）
   * @param id 消息ID（string）
   * @returns void
   */
  async deleteMessage(id: string): Promise<void> {
    const db = await this.ensureDb()
    await db.run(
      `UPDATE chat_message SET 
        status = ?, updated_at = ? 
       WHERE id = ?`,
      [ChatMessageStatus.DELETED, Date.now(), id]
    )
  }

  /**
   * 获取指定会话内遗漏的消息ID（同一个sessionId内，messageID不连续的缺失ID）
   * @param sessionId 会话ID（string）
   * @returns 缺失的消息ID列表（string格式）
   */
  async getLostMessageIds(sessionId: string): Promise<string[]> {
    const db = await this.ensureDb()
    // 步骤1：获取该会话下所有有效消息的ID（排除已删除），并按ID排序（假设ID为数字字符串，如"123"）
    const messages = await db.all<{ id: string }[]>(
      `SELECT id FROM chat_message 
       WHERE session_id = ? AND status != ? 
       ORDER BY id + 0 ASC`, // 按数字排序（避免"10"排在"2"前面）
      [sessionId, ChatMessageStatus.DELETED]
    )

    const messageIds = messages.map((item) => item.id)
    if (messageIds.length <= 1) return [] // 0或1条消息时无缺失

    // 步骤2：将字符串ID转为数字，计算范围
    const messageIdsNum = messageIds.map((id) => Number(id))
    const minId = messageIdsNum[0]
    const maxId = messageIdsNum[messageIdsNum.length - 1]

    // 步骤3：生成所有可能的ID（数字），对比实际存在的ID
    const allPossibleIds = new Set<number>()
    for (let i = minId; i <= maxId; i++) {
      allPossibleIds.add(i)
    }

    // 步骤4：找出缺失的ID，再转为字符串
    const lostIdsNum = Array.from(allPossibleIds).filter((id) => !messageIdsNum.includes(id))
    return lostIdsNum.map((id) => id.toString())
  }

  /**
   * 获取指定sessionId的最后一条数据的messageId
   * @param sessionId 会话ID（string）
   * @returns 最后一条消息ID（string格式，无数据返回空字符串）
   */
  async getLastMessageIdBySessionId(sessionId: string): Promise<string> {
    const db = await this.ensureDb()
    const result = await db.get<{ max_id: string | null }>(
      `SELECT MAX(id) AS max_id 
       FROM chat_message 
       WHERE session_id = ? AND status != ?`,
      [sessionId, ChatMessageStatus.DELETED]
    )
    return result?.max_id || ''
  }
}

export const chatSessionDB = new ChatSessionDB()
