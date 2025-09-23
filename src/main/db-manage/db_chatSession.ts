import { Database } from 'sqlite'
import { dbManager } from './database'
import { ChatMessage, ChatSession, MessageStatus } from '@shared/types'

/**
 * 数据库行记录类型（与表结构对应）- 已删减三个last_message_*字段
 */
export interface ChatSessionRow {
  id: string
  type: number
  first_id: string // 用户ID/群组ID
  second_id: string | null // 用户ID
  status: number
  created_at: number
  updated_at: number
}

export interface ChatMessageRow {
  id: number
  session_id: string
  message_id: string
  type: number
  from_id: string // 用户ID
  to_id: string // 用户ID/群组ID
  content: string | null
  status: number
  reply_to_id: string | null // 消息ID
  created_at: number
  updated_at: number
}

/**
 * 数据库行记录转换为业务对象
 * 核心：通过关联查询补充lastMessage相关字段
 */
const convertChatSessionRow2ChatSession = async (
  db: Database,
  data: ChatSessionRow
): Promise<ChatSession> => {
  // 关联查询该会话的最后一条有效消息
  const lastMessage = await db.get<ChatMessageRow>(
    `SELECT message_id, content, created_at 
     FROM chat_message 
     WHERE session_id = ? AND status != ? 
     ORDER BY created_at DESC 
     LIMIT 1`,
    [data.id, MessageStatus.TYPE_DELETED]
  )

  return {
    id: data.id,
    type: data.type,
    firstId: data.first_id,
    secondId: data.second_id,
    status: data.status,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    // 从关联查询结果中补充字段，无消息则用默认值
    lastMessageId: lastMessage?.message_id || '',
    lastMessageContent: lastMessage?.content || '',
    lastMessageTime: lastMessage?.created_at || 0
  }
}

const convertChatMessageRow2ChatMessage = (data: ChatMessageRow): ChatMessage => {
  return {
    id: data.id,
    sessionId: data.session_id,
    messageId: data.message_id,
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
 * 适配数据库字段删减，通过关联查询补充业务所需字段
 */
class ChatSessionDB {
  /**
   * 确保数据库连接可用
   */
  private async ensureDb(): Promise<Database> {
    try {
      const db = await dbManager.getPrivateDb()
      if (!db) throw new Error('数据库连接失败')
      return db
    } catch (error) {
      console.error('数据库连接异常:', error)
      throw error
    }
  }

  // ========================== 会话（ChatSession）相关操作 ==========================
  /**
   * 根据ID获取会话（含关联查询补充lastMessage字段）
   * @param id 会话ID（string）
   * @returns 会话对象或null（未找到）
   */
  async getSessionById(id: string): Promise<ChatSession | null> {
    const db = await this.ensureDb()
    const row = await db.get<ChatSessionRow>('SELECT * FROM chat_session WHERE id = ?', [id])
    return row ? convertChatSessionRow2ChatSession(db, row) : null
  }

  /**
   * 根据用户ID获取所有会话（单聊）- 批量关联查询优化版
   */
  async getSingleSessionsByUserId(userId: string): Promise<ChatSession[]> {
    const db = await this.ensureDb()
    // 1. 获取符合条件的会话列表
    const rows = await db.all<ChatSessionRow[]>(
      `SELECT * FROM chat_session
       WHERE (first_id = ? OR second_id = ?) AND status = ? AND type = 1 
       ORDER BY updated_at DESC`,
      [userId, userId, 1]
    )

    // 2. 批量查询会话的最后一条消息（减少N+1查询问题）
    if (rows.length === 0) return []
    const sessionIds = rows.map((row) => row.id)
    const placeholders = sessionIds.map(() => '?').join(',')

    const lastMessages = await db.all<
      {
        session_id: string
        message_id: string
        content: string | null
        created_at: number
      }[]
    >(
      `WITH ranked_messages AS (
        SELECT 
          session_id, 
          message_id, 
          content, 
          created_at,
          ROW_NUMBER() OVER (PARTITION BY session_id ORDER BY created_at DESC) AS rn
        FROM chat_message 
        WHERE session_id IN (${placeholders}) AND status != ?
      )
      SELECT session_id, message_id, content, created_at 
      FROM ranked_messages 
      WHERE rn = 1`,
      [...sessionIds, MessageStatus.TYPE_DELETED]
    )

    // 3. 构建消息映射表（sessionId -> 最后一条消息）
    const messageMap = new Map<string, (typeof lastMessages)[0]>()
    lastMessages.forEach((msg) => messageMap.set(msg.session_id, msg))

    // 4. 转换并补充字段
    return rows.map((row) => {
      const lastMsg = messageMap.get(row.id)
      return {
        id: row.id,
        type: row.type,
        firstId: row.first_id,
        secondId: row.second_id,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        lastMessageId: lastMsg?.message_id || '',
        lastMessageContent: lastMsg?.content || '',
        lastMessageTime: lastMsg?.created_at || 0
      }
    })
  }

  /**
   * 根据用户IDs获取指定会话（单聊）
   */
  async getSingleSessionByUserIds(firstId: string, secondId: string): Promise<ChatSession | null> {
    const db = await this.ensureDb()
    const row = await db.get<ChatSessionRow>(
      `SELECT * FROM chat_session
       WHERE (first_id = ? AND second_id = ? OR second_id = ? AND first_id = ?) 
       AND status = ? AND type = 1 
       LIMIT 1`,
      [firstId, secondId, firstId, secondId, 1]
    )
    return row ? convertChatSessionRow2ChatSession(db, row) : null
  }

  /**
   * 根据群组ID获取会话（群聊）
   */
  async getGroupSessionByGroupId(groupId: string): Promise<ChatSession | null> {
    const db = await this.ensureDb()
    const row = await db.get<ChatSessionRow>(
      `SELECT * FROM chat_session
       WHERE type = 2 AND first_id = ? AND status = 1`,
      [groupId]
    )
    return row ? convertChatSessionRow2ChatSession(db, row) : null
  }

  /**
   * 根据群组ID列表获取所有会话（群聊）- 批量关联查询优化版
   */
  async getGroupSessionsByGroupIds(groupIds: string[]): Promise<ChatSession[]> {
    if (groupIds.length === 0) return []

    const db = await this.ensureDb()
    const placeholders = groupIds.map(() => '?').join(',')

    // 1. 获取符合条件的会话列表
    const rows = await db.all<ChatSessionRow[]>(
      `SELECT * FROM chat_session
       WHERE type = 2 AND first_id IN (${placeholders}) AND status = 1 
       ORDER BY updated_at DESC`,
      groupIds
    )

    // 2. 批量查询最后一条消息（同单聊逻辑）
    const sessionIds = rows.map((row) => row.id)
    if (sessionIds.length === 0) return []

    const msgPlaceholders = sessionIds.map(() => '?').join(',')
    const lastMessages = await db.all<
      {
        session_id: string
        message_id: string
        content: string | null
        created_at: number
      }[]
    >(
      `WITH ranked_messages AS (
        SELECT 
          session_id, 
          message_id, 
          content, 
          created_at,
          ROW_NUMBER() OVER (PARTITION BY session_id ORDER BY created_at DESC) AS rn
        FROM chat_message 
        WHERE session_id IN (${msgPlaceholders}) AND status != ?
      )
      SELECT session_id, message_id, content, created_at 
      FROM ranked_messages 
      WHERE rn = 1`,
      [...sessionIds, MessageStatus.TYPE_DELETED]
    )

    // 3. 构建消息映射表并转换
    const messageMap = new Map<string, (typeof lastMessages)[0]>()
    lastMessages.forEach((msg) => messageMap.set(msg.session_id, msg))

    return rows.map((row) => {
      const lastMsg = messageMap.get(row.id)
      return {
        id: row.id,
        type: row.type,
        firstId: row.first_id,
        secondId: row.second_id,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        lastMessageId: lastMsg?.message_id || '',
        lastMessageContent: lastMsg?.content || '',
        lastMessageTime: lastMsg?.created_at || 0
      }
    })
  }

  /**
   * 添加或更新会话信息（已移除对删减字段的操作）
   */
  async addOrUpdateSession(session: ChatSession): Promise<void> {
    const db = await this.ensureDb()
    const existingSession = await this.getSessionById(session.id)

    if (existingSession) {
      // 存在则更新（仅包含数据库中实际存在的字段）
      await db.run(
        `UPDATE chat_session SET 
          type = ?, first_id = ?, second_id = ?,  
          status = ?, updated_at = ?
        WHERE id = ?`,
        [
          session.type,
          session.firstId,
          session.secondId,
          session.status,
          session.updatedAt,
          session.id
        ]
      )
    } else {
      // 不存在则插入（仅包含数据库中实际存在的字段）
      await db.run(
        `INSERT INTO chat_session (
          id, type, first_id, second_id,
          status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          session.id,
          session.type,
          session.firstId,
          session.secondId,
          session.status,
          session.createdAt,
          session.updatedAt
        ]
      )
    }
  }

  /**
   * 获取用户相关单聊会话的最晚更新时间（基于最后一条消息时间）
   */
  async getLatestSingleSessionUpdateAt(userId: string): Promise<number> {
    const db = await this.ensureDb()
    // 关联查询：先找到用户的所有单聊会话，再查这些会话的最后一条消息时间
    const result = await db.get<{ max_time: number | null }>(
      `SELECT MAX(m.created_at) AS max_time
       FROM chat_session s
       LEFT JOIN (
         SELECT session_id, MAX(created_at) AS created_at
         FROM chat_message
         WHERE status != ?
         GROUP BY session_id
       ) m ON s.id = m.session_id
       WHERE (s.first_id = ? OR s.second_id = ?) 
       AND s.type = 1 
       AND s.status = 1`,
      [MessageStatus.TYPE_DELETED, userId, userId]
    )
    return result?.max_time || 0
  }

  /**
   * 获取群聊会话的最晚更新时间（基于最后一条消息时间）
   */
  async getLatestGroupSessionUpdateAt(groupIds: string[]): Promise<number> {
    if (groupIds.length === 0) return 0

    const db = await this.ensureDb()
    const placeholders = groupIds.map(() => '?').join(',')

    // 关联查询：先找到指定群组会话，再查这些会话的最后一条消息时间
    const result = await db.get<{ max_time: number | null }>(
      `SELECT MAX(m.created_at) AS max_time
       FROM chat_session s
       LEFT JOIN (
         SELECT session_id, MAX(created_at) AS created_at
         FROM chat_message
         WHERE status != ?
         GROUP BY session_id
       ) m ON s.id = m.session_id
       WHERE s.type = 2 
       AND s.first_id IN (${placeholders})
       AND s.status = 1`,
      [MessageStatus.TYPE_DELETED, ...groupIds]
    )
    return result?.max_time || 0
  }

  // ========================== 消息（ChatMessage）相关操作 ==========================
  /**
   * 根据ID获取消息
   */
  async getMessageById(id: number): Promise<ChatMessage | null> {
    const db = await this.ensureDb()
    const row = await db.get<ChatMessageRow>('SELECT * FROM chat_message WHERE id = ?', [id])
    return row ? convertChatMessageRow2ChatMessage(row) : null
  }

  /**
   * 根据会话ID获取消息列表（分页）
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
       ORDER BY created_at DESC 
       LIMIT ? OFFSET ?`,
      [sessionId, MessageStatus.TYPE_DELETED, pageSize, offset]
    )
    return rows.map(convertChatMessageRow2ChatMessage)
  }

  /**
   * 根据会话ID获取消息列表（游标分页，按数字类型message_id排序）
   */
  async getMessagesBySessionIdUsingCursor(
    sessionId: string,
    ltMessageId: string,
    size: number
  ): Promise<ChatMessage[]> {
    const db = await this.ensureDb()
    const rows = await db.all<ChatMessageRow[]>(
      `SELECT * FROM chat_message
       WHERE session_id = ? AND status != ? 
       AND CAST(message_id AS BIGINT) < ?
       ORDER BY CAST(message_id AS BIGINT) DESC
       LIMIT ?`,
      [sessionId, MessageStatus.TYPE_DELETED, ltMessageId, size]
    )
    return rows.map(convertChatMessageRow2ChatMessage)
  }

  /**
   * 根据会话ID和消息ID获取单条消息（排除指定messageId）
   */
  async getMessagesBySessionIdAndMessageId(
    sessionId: string,
    messageId: string
  ): Promise<ChatMessage | null> {
    const db = await this.ensureDb()
    const row = await db.get<ChatMessageRow>(
      `SELECT * FROM chat_message
       WHERE session_id = ? AND message_id = ?
       LIMIT 1`,
      [sessionId, messageId]
    )
    return row ? convertChatMessageRow2ChatMessage(row) : null
  }

  /**
   * 添加或更新消息（新增消息时更新会话的updated_at）
   */
  async addOrUpdateMessage(message: ChatMessage): Promise<void> {
    const db = await this.ensureDb()
    const existingMessage = await this.getMessagesBySessionIdAndMessageId(
      message.sessionId,
      message.messageId
    )

    if (existingMessage) {
      // 存在则更新消息
      await db.run(
        `UPDATE chat_message SET 
          type = ?, from_id = ?, to_id = ?, content = ?, 
          status = ?, reply_to_id = ?, updated_at = ? 
        WHERE session_id = ? and message_id = ?`,
        [
          message.type,
          message.fromId,
          message.toId,
          message.content,
          message.status,
          message.replyToId,
          message.updatedAt,
          message.sessionId,
          message.messageId
        ]
      )
    } else {
      // 不存在则插入消息，并更新会话的更新时间
      await db.run(
        `INSERT INTO chat_message (
          session_id, message_id, type, from_id, to_id, content, status, 
          reply_to_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          message.sessionId,
          message.messageId,
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

      // 同步更新会话的updated_at为消息创建时间
      await db.run(
        `UPDATE chat_session 
         SET updated_at = ? 
         WHERE id = ? AND status = 1`,
        [message.createdAt, message.sessionId]
      )
    }
  }

  /**
   * 删除消息（逻辑删除）
   */
  async deleteMessage(session_id: string, message_id: string): Promise<void> {
    const db = await this.ensureDb()

    // 先获取要删除的消息
    const message = await db.get<ChatMessageRow>(
      `SELECT * FROM chat_message 
       WHERE session_id = ? AND message_id = ?`,
      [session_id, message_id]
    )

    if (message) {
      // 1. 逻辑删除消息
      await db.run(
        `UPDATE chat_message SET 
          status = ?, updated_at = ? 
         WHERE session_id = ? and message_id = ?`,
        [MessageStatus.TYPE_DELETED, Date.now(), session_id, message_id]
      )

      // 2. 更新会话的updated_at为当前时间
      await db.run(
        `UPDATE chat_session 
         SET updated_at = ? 
         WHERE id = ? AND status = 1`,
        [Date.now(), session_id]
      )
    }
  }

  /**
   * 获取指定会话内遗漏的消息ID
   */
  async getLostMessageIds(sessionId: string): Promise<string[]> {
    const db = await this.ensureDb()
    const messages = await db.all<{ message_id: string }[]>(
      `SELECT message_id FROM chat_message 
       WHERE session_id = ? AND status != ? 
       ORDER BY CAST(message_id AS INTEGER) ASC`,
      [sessionId, MessageStatus.TYPE_DELETED]
    )

    const messageIds = messages.map((item) => item.message_id)
    if (messageIds.length <= 1) return []

    // 过滤非数字ID，避免异常
    const messageIdsNum = messageIds
      .map((id) => {
        const num = Number(id)
        return isNaN(num) ? -1 : num
      })
      .filter((num) => num !== -1)

    if (messageIdsNum.length <= 1) return []

    const minId = messageIdsNum[0]
    const maxId = messageIdsNum[messageIdsNum.length - 1]

    const allPossibleIds = new Set<number>()
    for (let i = minId; i <= maxId; i++) {
      allPossibleIds.add(i)
    }

    const lostIdsNum = Array.from(allPossibleIds).filter((id) => !messageIdsNum.includes(id))
    return lostIdsNum.map((id) => id.toString())
  }

  /**
   * 获取指定sessionId的最后一条消息ID
   */
  async getLastMessageIdBySessionId(sessionId: string): Promise<string | null> {
    const db = await this.ensureDb()
    const result = await db.get<{ last_message_id: string | null }>(
      `SELECT message_id AS last_message_id 
       FROM chat_message 
       WHERE session_id = ? AND status != ?
       ORDER BY CAST(message_id AS BIGINT) DESC 
       LIMIT 1`,
      [sessionId, MessageStatus.TYPE_DELETED]
    )
    return result?.last_message_id || null
  }
}

export const chatSessionDB = new ChatSessionDB()
