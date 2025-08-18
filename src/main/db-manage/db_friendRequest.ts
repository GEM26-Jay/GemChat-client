import { Database } from 'sqlite'
import { getDb } from './database'
import { FriendRequest } from '@shared/types'

/** 数据库表行数据结构（与SQL表字段完全对应） */
interface FriendRequestRow {
  id: string
  from_id: string
  to_id: string
  from_remark: string
  to_remark: string
  statement: string
  status: number
  created_at: number
  updated_at: number
}

class FriendRequestDB {
  private dbPromise: Promise<Database>

  constructor() {
    this.dbPromise = getDb()
  }

  /** 确保数据库连接有效 */
  private async ensureDb(): Promise<Database> {
    try {
      const db = await this.dbPromise
      if (!db) throw new Error('数据库连接失败')
      return db
    } catch (error) {
      console.error('好友申请表数据库连接异常:', error)
      throw error
    }
  }

  /**
   * 根据ID查询好友申请
   * @param id 申请记录ID
   * @returns 好友申请详情或null
   */
  async getRequestById(id: string): Promise<FriendRequest | null> {
    if (!id) return null // 前置校验空ID

    const db = await this.ensureDb()
    const row = await db.get<FriendRequestRow>('SELECT * FROM friend_request WHERE id = ?', [id])
    return this.convertRowToRequest(row)
  }

  /**
   * 查询用户发出的所有申请
   * @param fromId 申请人ID
   * @returns 申请列表
   */
  async getRequestsByFromId(fromId: string): Promise<FriendRequest[]> {
    if (!fromId) return [] // 前置校验空ID

    const db = await this.ensureDb()
    const rows = await db.all<FriendRequestRow[]>(
      'SELECT * FROM friend_request WHERE from_id = ? ORDER BY created_at DESC',
      [fromId]
    )
    return rows.map((row) => this.convertRowToRequest(row) as FriendRequest)
  }

  /**
   * 查询用户收到的所有申请
   * @param toId 被申请人ID
   * @returns 申请列表
   */
  async getRequestsByToId(toId: string): Promise<FriendRequest[]> {
    if (!toId) return [] // 前置校验空ID

    const db = await this.ensureDb()
    const rows = await db.all<FriendRequestRow[]>(
      'SELECT * FROM friend_request WHERE to_id = ? ORDER BY created_at DESC',
      [toId]
    )
    return rows.map((row) => this.convertRowToRequest(row) as FriendRequest)
  }

  /**
   * 查询和用户相关的所有好友申请（包括发出的和收到的）
   * @param id 用户ID
   * @returns 按时间倒序排列的申请列表（最新的在前）
   */
  async getRelatedRequestsByUserId(id: string): Promise<FriendRequest[]> {
    if (!id) return [] // 前置校验：用户ID为空时返回空列表

    const db = await this.ensureDb()
    // 查询条件：申请人是当前用户 或 被申请人是当前用户
    const rows = await db.all<FriendRequestRow[]>(
      `SELECT * FROM friend_request 
     WHERE from_id = ? OR to_id = ? 
     ORDER BY created_at DESC`,
      [id, id] // 两个参数都传入用户ID，分别匹配from_id和to_id
    )

    // 转换为FriendRequest类型并返回
    return rows.map((row) => this.convertRowToRequest(row) as FriendRequest)
  }

  /**
   * 查询指定状态的申请
   * @param toId 被申请人ID
   * @param status 申请状态（0-待处理，1-已通过，2-已拒绝）
   * @returns 符合条件的申请列表
   */
  async getRequestsByStatus(toId: string, status: number): Promise<FriendRequest[]> {
    if (!toId) return [] // 前置校验空ID

    const db = await this.ensureDb()
    const rows = await db.all<FriendRequestRow[]>(
      'SELECT * FROM friend_request WHERE to_id = ? AND status = ? ORDER BY created_at DESC',
      [toId, status]
    )
    return rows.map((row) => this.convertRowToRequest(row) as FriendRequest)
  }

  /**
   * 添加新好友申请
   * @param request 好友申请信息
   */
  async addRequest(request: FriendRequest): Promise<void> {
    // 前置校验必填字段
    if (!request.id || !request.fromId || !request.toId) {
      throw new Error('申请ID、申请人ID和被申请人ID为必填项')
    }

    // 检查重复申请
    const isDuplicate = await this.checkDuplicateRequest(request.fromId, request.toId)
    if (isDuplicate) {
      throw new Error('已向该用户发送过未处理的申请')
    }

    const db = await this.ensureDb()
    const timestamp = Date.now()
    const result = await db.run(
      `INSERT INTO friend_request (
        id, from_id, to_id, from_remark, to_remark, 
        statement, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        request.id,
        request.fromId,
        request.toId,
        request.fromRemark || '',
        request.toRemark || '',
        request.statement || '',
        request.status ?? 0, // 使用空值合并运算符更严谨
        request.createdAt ?? timestamp,
        request.updatedAt ?? timestamp
      ]
    )

    // 验证插入结果
    if (result.changes !== 1) {
      throw new Error(`添加好友申请失败，影响行数: ${result.changes}`)
    }
  }

  async upsertRequest(request: FriendRequest): Promise<number> {
    if (!request.id) {
      console.error('UPSERT操作失败：申请ID不能为空')
      return 0
    }

    try {
      const db = await this.ensureDb()
      const result = await db.run(
        `INSERT OR REPLACE INTO friend_request 
             (id, from_id, to_id, from_remark, to_remark, statement, status, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          request.id,
          request.fromId,
          request.toId,
          request.fromRemark || '',
          request.toRemark || '',
          request.statement || '',
          request.status,
          request.updatedAt || Date.now()
        ]
      )
      if (result.changes) {
        return result.changes
      } else {
        return 0
      }
    } catch (error) {
      console.error('好友申请UPSERT操作失败:', error)
      return 0
    }
  }

  /**
   * 删除好友申请记录
   * @param id 申请记录ID
   */
  async deleteRequest(id: string): Promise<void> {
    if (!id) throw new Error('申请ID为必填项') // 前置校验

    const db = await this.ensureDb()
    const result = await db.run('DELETE FROM friend_request WHERE id = ?', [id])

    // 验证删除结果
    if (result.changes !== 1) {
      throw new Error(`删除申请失败，未找到ID为${id}的申请记录`)
    }
  }

  /**
   * 检查申请是否已存在（避免重复申请）
   * @param fromId 申请人ID
   * @param toId 被申请人ID
   * @returns 是否存在未处理的申请
   */
  async checkDuplicateRequest(fromId: string, toId: string): Promise<boolean> {
    if (!fromId || !toId) return false // 前置校验

    const db = await this.ensureDb()
    const row = await db.get<FriendRequestRow>(
      'SELECT id FROM friend_request WHERE from_id = ? AND to_id = ? AND status = 0',
      [fromId, toId]
    )
    return !!row
  }

  /**
   * 获取好友申请表中与当前用户相关的最后更新时间戳
   * @param id 用户ID
   * @returns 最后更新时间戳（毫秒），无数据时返回null
   */
  async getLatestUpdateTimestamp(id: string): Promise<number | null> {
    const db = await this.ensureDb()

    try {
      // 使用参数化查询防止SQL注入
      const result = await db.get<{ max_updated: number | null }>(
        `SELECT MAX(updated_at) AS max_updated 
             FROM friend_request 
             WHERE from_id = ? OR to_id = ?`,
        [id, id] // 绑定用户ID参数
      )

      // 显式处理可能的null（MAX函数在无数据时返回null）
      return result?.max_updated ?? null
    } catch (error) {
      console.error(`获取用户${id}的好友申请最后更新时间失败:`, error)
      return null
    }
  }

  /**
   * 转换数据库行数据为FriendRequest类型
   * @param row 数据库行数据
   * @returns 转换后的FriendRequest对象或null
   */
  private convertRowToRequest(row: FriendRequestRow | undefined | null): FriendRequest | null {
    if (!row) return null

    return {
      id: row.id,
      fromId: row.from_id,
      toId: row.to_id,
      fromRemark: row.from_remark || '',
      toRemark: row.to_remark || '',
      statement: row.statement || '',
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }
  }
}

export const friendRequestDB = new FriendRequestDB()
