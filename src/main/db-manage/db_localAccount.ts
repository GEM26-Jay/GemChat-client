import { LoginFormData } from '@shared/types'
import { Database } from 'sqlite'
import { getDb } from './database'

interface DbLocalAccountRow {
  account: string
  password: string
  avatar?: string
  is_agree?: number
}

const DbLocalAccountRow2LoginFormData = (data: DbLocalAccountRow): LoginFormData => {
  return {
    account: data.account,
    password: data.password,
    avatar: data.avatar,
    isAgree: !(data.is_agree === 0)
  }
}

class LocalAccountDB {
  private dbPromise: Promise<Database>

  constructor() {
    this.dbPromise = getDb()
  }

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

  async getAll(): Promise<LoginFormData[]> {
    const db = await this.ensureDb()
    const results: DbLocalAccountRow[] = await db.all('SELECT * FROM local_account')
    return results.map((row) => DbLocalAccountRow2LoginFormData(row))
  }

  async addOrUpdata(data: LoginFormData): Promise<void> {
    const db = await this.ensureDb()
    await db.run(
      `INSERT OR REPLACE INTO local_account 
     (account, password, avatar, is_agree) 
     VALUES (?, ?, ?, ?)`,
      [data.account, data.password, data.avatar, data.isAgree ? 1 : 0]
    )
  }

  async delete(account: string): Promise<void> {
    const db = await this.ensureDb()
    await db.run('DELETE FROM local_account WHERE account = ?', [account])
  }
}

export const localAccountDB: LocalAccountDB = new LocalAccountDB()
