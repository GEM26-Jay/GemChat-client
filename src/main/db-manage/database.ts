import sqlite3 from 'sqlite3'
import { open, Database } from 'sqlite'
import fs from 'fs/promises'
import * as path from 'path'
import { app } from 'electron' // 若在主进程中使用

// 获取用户数据目录下的数据库路径
const getUserDatabaseDir = (): string => {
  const userDataPath = app.getPath('userData')
  const appDataPath = path.join(userDataPath, 'Local Storage', 'database')
  // 确保目录存在（复用之前的创建逻辑）
  fs.mkdir(appDataPath, { recursive: true }).catch(() => {})
  return appDataPath
}

let dbPath: string
;(() => {
  const dataDir = getUserDatabaseDir()
  dbPath = path.join(dataDir, 'chat.db')
})()

// 初始化 SQL 脚本路径
const initSqlPath = 'resources/sqlite-init.sql'

// 单例模式：全局唯一数据库连接
class DatabaseSingleton {
  private static instance: DatabaseSingleton | null = null
  private db: Database | null = null
  private isConnecting = false
  private static isInitialized = false // 静态初始化标记

  private constructor() {
    // 单例模式
  }

  private static async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      // 关键修改：添加 await 获取实际实例
      const instance = await this.getInstance()
      await instance.connect()
      this.isInitialized = true
      console.log('[Database]: 数据库已自动初始化')
    } catch (err) {
      console.error('[Database]: 数据库初始化失败:', err)
      throw err
    }
  }

  // 获取单例实例（确保已初始化）
  static async getInstance(): Promise<DatabaseSingleton> {
    if (!this.instance) {
      this.instance = new DatabaseSingleton()
      await this.initialize() // 自动初始化
    }
    return this.instance
  }

  // 连接数据库（内部使用）
  private async connect(): Promise<void> {
    if (this.db) return
    if (this.isConnecting) {
      return new Promise<void>((resolve) => {
        const check = setInterval(() => {
          if (this.db) {
            clearInterval(check)
            resolve()
          }
        }, 100)
      })
    }

    this.isConnecting = true
    try {
      this.db = await open({
        filename: dbPath,
        driver: sqlite3.Database
      })
      await this.runInitScript()
    } finally {
      this.isConnecting = false
    }
  }

  // 执行初始化脚本
  private async runInitScript(): Promise<void> {
    if (!this.db) throw new Error('数据库未连接')
    const initSql = await fs.readFile(initSqlPath, 'utf8')
    await this.db.exec(initSql)
    // await this.db.exec(mockSql)
  }

  // 对外提供数据库实例（确保已连接）
  async getDb(): Promise<Database> {
    if (!this.db) await this.connect()
    return this.db!
  }

  // 关闭连接
  async close(): Promise<void> {
    if (this.db) {
      await this.db.close()
      this.db = null
      DatabaseSingleton.isInitialized = false
    }
  }
}

export async function getDb(): Promise<Database> {
  try {
    const instance = await DatabaseSingleton.getInstance()
    const db = await instance.getDb()
    if (!db) {
      throw new Error('数据库实例未正确初始化')
    }
    return db
  } catch (error) {
    console.error('[Database]: 获取数据库连接失败:', error)
    // 这里可以选择重试逻辑或抛出更具体的错误
    throw new Error('数据库连接不可用，请检查配置')
  }
}
