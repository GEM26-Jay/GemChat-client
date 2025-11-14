import { Database } from 'sqlite'
import { dbManager } from './database'
import { FileMap, FileMapStatus } from '@shared/types'

/**
 * 数据库表行记录类型（与修改后的file_map表结构对应）
 */
interface DbFileMapRow {
  id: number
  origin_name: string
  remote_name: string
  fingerprint: string
  size: number
  mime_type: string
  location: string
  status: number
  created_at: number
  updated_at: number
  source_type: number
  session_id?: string
  source_info?: string
}

/**
 * 数据库行记录转换为业务对象
 */
const DbFileMapRow2FileMap = (data: DbFileMapRow): FileMap => {
  return {
    id: data.id,
    originName: data.origin_name,
    remoteName: data.remote_name,
    fingerprint: data.fingerprint,
    size: data.size,
    mimeType: data.mime_type,
    location: data.location,
    status: data.status,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    sourceType: data.source_type,
    sessionId: data.session_id,
    sourceInfo: data.source_info
  }
}

/**
 * 文件映射表数据库操作类
 * 封装file_map表的CRUD操作
 */
class FileMapDB {
  /**
   * 确保数据库连接可用
   */
  private async ensureDb(): Promise<Database> {
    try {
      const db = await dbManager.getPrivateDb()
      if (!db) throw new Error('数据库连接失败')
      return db
    } catch (error) {
      console.error('文件映射表数据库连接异常:', error)
      throw error
    }
  }

  /**
   * 查询所有文件映射记录
   */
  async getAll(): Promise<FileMap[]> {
    const db = await this.ensureDb()
    const results: DbFileMapRow[] = await db.all('SELECT * FROM file_map')
    return results.map((row) => DbFileMapRow2FileMap(row))
  }

  /**
   * 根据ID查询文件映射记录
   */
  async getById(id: number): Promise<FileMap | null> {
    const db = await this.ensureDb()
    const result: DbFileMapRow | undefined = await db.get<DbFileMapRow>(
      'SELECT * FROM file_map WHERE id = ?',
      id
    )
    return result ? DbFileMapRow2FileMap(result) : null
  }

  /**
   * 根据文件指纹查询文件映射记录
   */
  async getByFingerprint(fingerprint: string): Promise<FileMap | null> {
    const db = await this.ensureDb()
    const result: DbFileMapRow | undefined = await db.get<DbFileMapRow>(
      'SELECT * FROM file_map WHERE fingerprint = ?',
      fingerprint
    )
    return result ? DbFileMapRow2FileMap(result) : null
  }

  /**
   * 根据会话ID查询文件映射记录
   */
  async getBySessionId(sessionId: string): Promise<FileMap[]> {
    const db = await this.ensureDb()
    const results: DbFileMapRow[] = await db.all(
      'SELECT * FROM file_map WHERE session_id = ?',
      sessionId
    )
    return results.map((row) => DbFileMapRow2FileMap(row))
  }

  /**
   * 根据会话ID和文件指纹查询文件映射记录
   */
  async getBySessionAndFingerprint(
    sessionId: string,
    fingerprint: string
  ): Promise<FileMap | null> {
    const db = await this.ensureDb()
    const result: DbFileMapRow[] = await db.all(
      'SELECT * FROM file_map WHERE session_id = ? AND fingerprint = ?',
      [sessionId, fingerprint]
    )
    return result.length > 0 ? DbFileMapRow2FileMap(result[0]) : null
  }

  /**
   * 批量查询文件映射记录
   */
  async getByIds(ids: number[]): Promise<FileMap[]> {
    if (ids.length === 0) return []

    const db = await this.ensureDb()
    const placeholders = ids.map(() => '?').join(',')
    const results: DbFileMapRow[] = await db.all(
      `SELECT * FROM file_map WHERE id IN (${placeholders})`,
      ids
    )
    return results.map((row) => DbFileMapRow2FileMap(row))
  }

  /**
   * 添加或修改(必须持有SessionId和Fingerprint)
   */
  async addOrUpdateBySessionAndFingerprint(data: FileMap): Promise<void> {
    const db = await this.ensureDb()

    // 自动填充时间戳
    const now = Date.now()
    const finalData = {
      ...data,
      createdAt: data.createdAt || now,
      updatedAt: now // 更新时强制刷新updatedAt
    }

    // 核心逻辑：session_id和fingerprint都不为空时，先查是否存在
    if (finalData.sessionId && finalData.fingerprint) {
      // 1. 先查询是否存在匹配记录
      const results: DbFileMapRow | undefined = await db.get(
        `SELECT id FROM file_map WHERE session_id = ? AND fingerprint = ? LIMIT 1`,
        [finalData.sessionId, finalData.fingerprint]
      )
      // 2. 存在则更新，不存在则插入
      if (results != undefined && results != null) {
        // 更新语句：只更新需要变更的字段
        await db.run(
          `UPDATE file_map SET 
          origin_name = ?,
          remote_name = ?,
          size = ?,
          mime_type = ?,
          location = ?,
          status = ?,
          updated_at = ?,
          source_type = ?,
          source_info = ?
        WHERE session_id = ? AND fingerprint = ?`,
          [
            finalData.originName,
            finalData.remoteName,
            finalData.size,
            finalData.mimeType,
            finalData.location,
            finalData.status,
            finalData.updatedAt,
            finalData.sourceType,
            finalData.sourceInfo,
            finalData.sessionId,
            finalData.fingerprint
          ]
        )
        return
      }
    }

    // 3. session_id为空 或 无匹配记录 → 直接插入新数据
    await db.run(
      `INSERT INTO file_map 
     (origin_name, remote_name, fingerprint, size, mime_type, 
      location, status, created_at, updated_at, 
      source_type, session_id, source_info) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        finalData.originName,
        finalData.remoteName,
        finalData.fingerprint,
        finalData.size,
        finalData.mimeType,
        finalData.location,
        finalData.status,
        finalData.createdAt,
        finalData.updatedAt,
        finalData.sourceType,
        finalData.sessionId,
        finalData.sourceInfo
      ]
    )
  }

  /**
   * 标记文件为已删除（逻辑删除）
   */
  async delete(id: number): Promise<void> {
    const db = await this.ensureDb()
    const now = Date.now()
    await db.run(
      `UPDATE file_map 
       SET status = 0, updated_at = ? 
       WHERE id = ?`,
      [now, id]
    )
  }

  async getByCursor(startId: number, size: number): Promise<FileMap[]> {
    const db = await this.ensureDb()
    const data = await db.all<DbFileMapRow[]>(
      'SELECT * FROM file_map WHERE id < ? ORDER BY id desc limit ? ',
      [startId, size]
    )
    return data ? data.map((row) => DbFileMapRow2FileMap(row)) : []
  }

  /**
   * 根据远程文件名更新全部状态
   */
  async updateStatusByFingerprint(status: FileMapStatus, fingerprint: string): Promise<void> {
    const db = await this.ensureDb()
    await db.run(
      `UPDATE file_map SET 
       status = ?
       WHERE 
       fingerprint = ?`,
      [status, fingerprint]
    )
  }

  /**
   * 获取 已经同步了的文件
   */
  async getAllSynced(): Promise<FileMap[]> {
    const db = await this.ensureDb()
    const results: DbFileMapRow[] = await db.all(
      'SELECT * FROM file_map where status=?',
      FileMapStatus.SYNCED
    )
    return results.map((row) => DbFileMapRow2FileMap(row))
  }
}

/**
 * 导出单例实例
 */
export const fileMapDB: FileMapDB = new FileMapDB()
