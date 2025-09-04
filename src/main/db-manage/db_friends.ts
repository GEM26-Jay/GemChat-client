import { Database } from 'sqlite'
import { getDb } from './database'
import { UserFriend } from '@shared/types'

// 数据库表结构对应的行记录类型（下划线命名，与表字段完全对应）
interface UserFriendRow {
  id: string
  user_id: string
  friend_id: string
  block_status: number
  delete_status: number // 数据库表字段
  remark: string
  created_at: number
  updated_at: number
}

/**
 * 数据库行记录转业务类型（下划线转驼峰）
 * 精准映射表字段与类型定义
 */
const convertRowToUserFriend = (row: UserFriendRow): UserFriend | null => {
  if (!row) {
    return null
  }
  return {
    id: row.id,
    userId: row.user_id,
    friendId: row.friend_id,
    blockStatus: row.block_status,
    deleteStatus: row.delete_status,
    remark: row.remark,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  } as UserFriend
}

class UserFriendDB {
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
      console.error('数据库连接异常:', error)
      throw error
    }
  }

  /**
   * 业务类型转数据库字段（驼峰转下划线）
   * 用于新增和更新操作的数据转换
   */
  private convertUserFriendToRow(relation: UserFriend): Omit<UserFriendRow, 'id'> {
    return {
      user_id: relation.userId,
      friend_id: relation.friendId,
      block_status: relation.blockStatus,
      delete_status: relation.deleteStatus, // 关键映射：类型deleteStatus → 表字段delete_status
      remark: relation.remark,
      created_at: relation.createdAt,
      updated_at: relation.updatedAt
    }
  }

  /**
   * 根据关系ID查询好友关系
   * @param id 关系ID
   * @returns 好友关系对象或null
   */
  async getFriendRelationById(id: string): Promise<UserFriend | null> {
    const db = await this.ensureDb()
    const row = await db.get<UserFriendRow | null>('SELECT * FROM user_friend WHERE id = ?', [id])
    return row ? convertRowToUserFriend(row) : null
  }

  /**
   * 查询用户的所有好友关系
   * @param userId 用户ID
   * @returns 好友关系列表
   */
  async getFriendRelationsByUserId(userId: string): Promise<UserFriend[]> {
    const db = await this.ensureDb()
    const rows = await db.all<UserFriendRow[]>('SELECT * FROM user_friend WHERE user_id = ?', [
      userId
    ])
    if (rows.length > 0) {
      return rows.map((row) => convertRowToUserFriend(row)) as UserFriend[]
    } else {
      return []
    }
  }

  /**
   * 查询用户的所有好友关系
   * @param userId 用户ID
   * @returns 好友关系列表
   */
  async getFriendRelationsByUserIdAndTargetId(
    userId: string,
    targetId: string
  ): Promise<UserFriend | null> {
    const db = await this.ensureDb()
    const row = await db.get<UserFriendRow>(
      'SELECT * FROM user_friend WHERE user_id = ? and friend_id = ?',
      [userId, targetId]
    )
    if (!row) {
      return null
    } else {
      return convertRowToUserFriend(row)
    }
  }

  /**
   * 添加好友关系
   * @param relation 好友关系数据
   * @returns 新增关系的ID
   */
  async addFriendRelation(relation: UserFriend): Promise<number> {
    const db = await this.ensureDb()
    const rowData = this.convertUserFriendToRow(relation)

    const result = await db.run(
      `INSERT INTO user_friend (
        user_id, friend_id, block_status, delete_status, 
        remark, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        rowData.user_id,
        rowData.friend_id,
        rowData.block_status || 0,
        rowData.delete_status || 0,
        rowData.remark || '',
        rowData.created_at || Date.now(),
        rowData.updated_at || Date.now()
      ]
    )

    if (result.changes) {
      return result.changes
    } else {
      return 0
    }
  }

  /**
   * 更新或插入好友关系信息（存在则更新，不存在则插入）
   * @param relation 包含完整信息的好友关系对象
   */
  async upsertFriendRelation(relation: UserFriend): Promise<number> {
    if (!relation.id) {
      console.error('UPSERT操作失败：好友关系ID不能为空')
      return 0
    }

    try {
      const db = await this.ensureDb()
      const rowData = this.convertUserFriendToRow(relation)

      const result = await db.run(
        `INSERT OR REPLACE INTO user_friend 
             (id, user_id, friend_id, block_status, delete_status, remark, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          relation.id, // 主键ID
          rowData.user_id, // 用户ID
          rowData.friend_id, // 好友ID
          rowData.block_status, // 拉黑状态
          rowData.delete_status, // 删除状态
          rowData.remark || '', // 备注（空值保护）
          rowData.created_at || Date.now(), // 创建时间（不存在则用当前时间）
          rowData.updated_at || Date.now() // 更新时间（不存在则用当前时间）
        ]
      )

      if (result.changes) {
        return result.changes // 返回是否操作成功
      } else {
        return 0
      }
    } catch (error) {
      console.error('好友关系UPSERT操作失败:', error)
      return 0
    }
  }

  /**
   * 根据关系ID删除好友关系
   * @param id 关系ID
   */
  async deleteFriendRelationById(id: string): Promise<void> {
    const db = await this.ensureDb()
    await db.run('DELETE FROM user_friend WHERE id = ?', [id])
  }

  /**
   * 删除用户与好友的关系
   * @param userId 用户ID
   * @param friendId 好友ID
   */
  async deleteFriendRelation(userId: string, friendId: string): Promise<void> {
    const db = await this.ensureDb()
    await db.run('DELETE FROM user_friend WHERE user_id = ? AND friend_id = ?', [userId, friendId])
  }

  /**
   * 获取用户的有效好友列表（未拉黑且未删除）
   * @param userId 用户ID
   * @returns 有效好友关系列表
   */
  async getValidFriends(userId: string): Promise<UserFriend[]> {
    const db = await this.ensureDb()
    const rows = await db.all<UserFriendRow[]>(
      `SELECT * FROM user_friend 
       WHERE user_id = ? 
       AND block_status in (0, 2) 
       AND delete_status in (0, 2)`,
      [userId]
    )
    if (rows.length > 0) {
      return rows.map((row) => convertRowToUserFriend(row)) as UserFriend[]
    } else {
      return []
    }
  }

  /**
   * 获取用户的黑名单列表（已拉黑或相互拉黑）
   * @param userId 用户ID
   * @returns 黑名单关系列表
   */
  async getBlacklist(userId: string): Promise<UserFriend[]> {
    const db = await this.ensureDb()
    const rows = await db.all<UserFriendRow[]>(
      `SELECT * FROM user_friend 
       WHERE user_id = ? 
       AND block_status IN (1, 3)`, // 1:已拉黑，3:相互拉黑
      [userId]
    )
    if (rows.length > 0) {
      return rows.map((row) => convertRowToUserFriend(row)) as UserFriend[]
    } else {
      return []
    }
  }

  /**
   * 获取用户好友关系中最后更新的时间戳
   * @param id 用户ID
   * @returns 最后更新时间戳（毫秒），无数据时返回null
   */
  async getLatestUpdateTimestamp(id: string): Promise<number | null> {
    try {
      const db = await this.ensureDb()

      const result = await db.get<{ max_updated: number | null }>(
        `SELECT MAX(updated_at) AS max_updated 
             FROM user_friend 
             WHERE user_id = ?`,
        [id] // 绑定用户ID参数
      )

      // 显式处理null情况
      return result?.max_updated ?? null
    } catch (error) {
      console.error(`获取用户[${id}]的好友关系最后更新时间失败:`, error)
      return null
    }
  }
}

export const userFriendDB = new UserFriendDB()
