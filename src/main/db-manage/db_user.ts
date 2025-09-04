import { User } from '@shared/types'
import { Database } from 'sqlite'
import { getDb } from './database'

/**
 * 数据库表行记录类型（与表结构对应）
 */
interface DbUserRow {
  id: string
  username: string
  masked_email?: string
  masked_phone?: string
  avatar: string
  signature: string
  gender: number
  birthdate: string
  status: number
  created_at: number
  updated_at: number
}

/**
 * 数据库行记录转换为业务对象
 */
const DbUserRow2User = (data: DbUserRow): User => {
  return {
    id: data.id,
    username: data.username,
    maskedEmail: data.masked_email || '',
    maskedPhone: data.masked_phone || '',
    avatar: data.avatar || '',
    signature: data.signature || '',
    gender: data.gender || 0,
    birthdate: data.birthdate || '',
    status: data.status || 1,
    createdAt: data.created_at,
    updatedAt: data.updated_at
  }
}

/**
 * 用户数据库操作类
 * 封装用户表的CRUD操作
 */
class UserDB {
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

  /**
   * 查询所有用户
   */
  async getAll(): Promise<User[]> {
    const db = await this.ensureDb()
    const results: DbUserRow[] = await db.all('SELECT * FROM user_profile')
    return results.map((row) => DbUserRow2User(row))
  }

  /**
   * 根据ID查询用户
   */
  async getById(id: string): Promise<User | null> {
    const db = await this.ensureDb()
    const result: DbUserRow[] = await db.all<DbUserRow[]>('SELECT * FROM user_profile WHERE id = ?', 
      id
    )
    return result.length > 0 ? DbUserRow2User(result[0]) : null
  }

  /**
   * 批量查询用户
   */
  async getByIds(ids: string[]): Promise<User[]> {
    if (ids.length === 0) return []

    const db = await this.ensureDb()
    const placeholders = ids.map(() => '?').join(',')
    const results: DbUserRow[] = await db.all(
      `SELECT * FROM user_profile WHERE id IN (${placeholders})`,
      ids
    )
    return results.map((row) => DbUserRow2User(row))
  }

  /**
   * 添加或更新用户（存在则更新，不存在则插入）
   */
  async addOrUpdate(data: User): Promise<void> {
    const db = await this.ensureDb()
    // 自动填充时间戳（如果未提供）
    const now = Date.now()
    const finalData = {
      ...data,
      createdAt: data.createdAt || now,
      updatedAt: data.updatedAt || now
    }

    await db.run(
      `INSERT OR REPLACE INTO user_profile 
       (id, username, masked_email, masked_phone, avatar, 
        signature, gender, birthdate, status, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        finalData.id,
        finalData.username,
        finalData.maskedEmail,
        finalData.maskedPhone,
        finalData.avatar,
        finalData.signature,
        finalData.gender,
        finalData.birthdate,
        finalData.status,
        finalData.createdAt,
        finalData.updatedAt
      ]
    )
  }

  /**
   * 根据ID删除用户
   */
  async delete(id: string): Promise<void> {
    const db = await this.ensureDb()
    await db.run('DELETE FROM user_profile WHERE id = ?', [id])
  }
}


/**
 * 导出单例实例
 */
export const userDB: UserDB = new UserDB()

// userDB.getAll()
// userDB.getById('344038612569948160')
