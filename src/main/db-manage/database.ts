import sqlite3 from 'sqlite3'
import { open, Database } from 'sqlite'
import fs from 'fs/promises'
import * as path from 'path'
import { app } from 'electron'

// -------------------------- 数据库路径配置 --------------------------
/** 公共数据库路径 */
const getPublicDbPath = (): string => {
  const userDataPath = app.getPath('userData')
  const appDataPath = path.join(userDataPath, 'Local Storage', 'database')
  fs.mkdir(appDataPath, { recursive: true }).catch(err =>
    console.warn('[Database]: 创建公共库目录失败:', err)
  )
  return path.join(appDataPath, 'public.db')
}

/** 用户私有数据库路径 */
const getUserDbPath = (userId: string): string => {
  if (!userId) {
    throw new Error('用户ID不能为空')
  }
  const userDataPath = app.getPath('userData')
  const appDataPath = path.join(userDataPath, 'Local Storage', 'database')
  fs.mkdir(appDataPath, { recursive: true }).catch(err =>
    console.warn('[Database]: 创建用户库目录失败:', err)
  )
  return path.join(appDataPath, `${userId}.db`)
}

// -------------------------- 数据库核心类 --------------------------
class DbInstance {
  private db: Database | null = null
  private isConnecting = false
  private isInitialized = false
  private readonly dbPath: string
  private readonly initSqlPath: string = 'resources/sqlite-init.sql'

  constructor(dbPath: string) {
    this.dbPath = dbPath
  }

  /** 连接数据库并执行初始化 */
  async connect(): Promise<Database> {
    if (this.db) return this.db

    if (this.isConnecting) {
      return new Promise<Database>(resolve => {
        const checkInterval = setInterval(() => {
          if (this.db) {
            clearInterval(checkInterval)
            resolve(this.db)
          }
        }, 100)
      })
    }

    this.isConnecting = true
    try {
      this.db = await open({
        filename: this.dbPath,
        driver: sqlite3.Database
      })

      if (!this.isInitialized) {
        await this.runInitScript()
        this.isInitialized = true
      }
      return this.db
    } catch (err) {
      console.error(`[Database]: 连接失败（${this.dbPath}）:`, err)
      this.db = null
      throw err
    } finally {
      this.isConnecting = false
    }
  }

  /** 获取数据库连接 */
  async getConnection(): Promise<Database> {
    if (!this.db) {
      return this.connect()
    }
    return this.db
  }

  /** 关闭数据库连接 */
  async close(): Promise<void> {
    if (this.db) {
      await this.db.close()
      this.db = null
      this.isInitialized = false
    }
  }

  /** 执行初始化SQL脚本 */
  private async runInitScript(): Promise<void> {
    if (!this.db) throw new Error('数据库未连接')

    try {
      const initSql = await fs.readFile(this.initSqlPath, 'utf8')
      await this.db.exec(initSql)
    } catch (err) {
      console.error(`[Database]: 初始化脚本执行失败:`, err)
      throw err
    }
  }
}

// -------------------------- 全局数据库管理器 --------------------------
class DatabaseManager {
  // 公共库实例（始终存在）
  private publicDb: DbInstance
  // 当前用户私有库实例（登录后存在）
  private currentPrivateDb: DbInstance | null = null
  // 当前登录用户ID
  private currentUserId: string | null = null

  constructor() {
    this.publicDb = new DbInstance(getPublicDbPath())
  }

  /** 设置当前用户私有库（登录时调用） */
  async setPrivateDb(userId: string): Promise<void> {
    // 已设置相同用户，无需重复操作
    if (this.currentUserId === userId && this.currentPrivateDb) {
      return
    }

    // 先关闭之前的私有库连接
    if (this.currentPrivateDb) {
      await this.currentPrivateDb.close()
    }

    // 创建新的私有库实例
    this.currentUserId = userId
    this.currentPrivateDb = new DbInstance(getUserDbPath(userId))
    await this.currentPrivateDb.connect()
    console.log(`[Database]: 已切换到用户私有库（用户ID: ${userId}）`)
  }

  /** 清除当前用户私有库（登出时调用） */
  async clearPrivateDb(): Promise<void> {
    if (this.currentPrivateDb) {
      await this.currentPrivateDb.close()
      this.currentPrivateDb = null
      this.currentUserId = null
      console.log('[Database]: 已清除当前用户私有库')
    }
  }

  /** 获取当前活跃数据库连接（私有库优先，否则用公共库） */
  async getActiveDb(): Promise<Database> {
    if (this.currentPrivateDb) {
      return this.currentPrivateDb.getConnection()
    }
    return this.publicDb.getConnection()
  }

  /** 直接获取公共库连接（用于需要强制访问公共库的场景） */
  async getPublicDb(): Promise<Database> {
    return this.publicDb.getConnection()
  }

  /** 直接获取当前私有库连接（仅登录后可用） */
  async getPrivateDb(): Promise<Database> {
    if (!this.currentPrivateDb) {
      throw new Error('未设置当前用户私有库，请先调用setPrivateDb')
    }
    return this.currentPrivateDb.getConnection()
  }

  /** 检查是否已登录（是否有活跃私有库） */
  isLoggedIn(): boolean {
    return !!this.currentPrivateDb
  }

  /** 获取当前登录用户ID */
  getCurrentUserId(): string | null {
    return this.currentUserId
  }
}

// 导出全局唯一的数据库管理器实例
export const dbManager = new DatabaseManager()

// -------------------------- 对外便捷API --------------------------
/** 获取当前活跃数据库连接（自动判断公共/私有） */
export async function getDb(): Promise<Database> {
  return dbManager.getActiveDb()
}

/** 设置当前用户私有库（登录时调用） */
export async function setPrivateDb(userId: string): Promise<void> {
  return dbManager.setPrivateDb(userId)
}

/** 清除当前用户私有库（登出时调用） */
export async function clearPrivateDb(): Promise<void> {
  return dbManager.clearPrivateDb()
}

/** 强制获取公共库连接 */
export async function getPublicDb(): Promise<Database> {
  return dbManager.getPublicDb()
}

/** 强制获取私有库连接（需已登录） */
export async function getPrivateDb(): Promise<Database> {
  return dbManager.getPrivateDb()
}

/** 检查是否已登录 */
export function isDbLoggedIn(): boolean {
  return dbManager.isLoggedIn()
}

/** 获取当前登录用户ID */
export function getCurrentDbUserId(): string | null {
  return dbManager.getCurrentUserId()
}
