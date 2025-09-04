import { Database } from 'sqlite'
import { getDb } from './database'
import { ChatGroup, GroupMember } from '@shared/types'

/**
 * 数据库行记录类型（与表结构对应）
 */
export interface ChatGroupRow {
  id: string
  name: string
  create_user: number
  avatar: string
  signature: string
  number: number
  status: number
  created_at: number
  updated_at: number
}

export interface GroupMemberRow {
  group_id: string
  user_id: string
  remark?: string
  status: number
  role: number
  created_at: number
  updated_at: number
}

/**
 * 数据库行记录转换为业务对象
 */
const convertGroupRow2Group = (data: ChatGroupRow): ChatGroup => {
  return {
    id: data.id,
    name: data.name,
    createUser: data.create_user,
    avatar: data.avatar,
    signature: data.signature,
    number: data.number,
    status: data.status,
    createdAt: data.created_at,
    updatedAt: data.updated_at
  }
}

const convertGroupMemberRow2GroupMember = (data: GroupMemberRow): GroupMember => {
  return {
    groupId: data.group_id,
    userId: data.user_id,
    remark: data.remark,
    status: data.status,
    role: data.role,
    createdAt: data.created_at,
    updatedAt: data.updated_at
  }
}

/**
 * 群组数据库操作类
 * 封装群组表和群组成员表的CRUD操作
 */
class GroupDB {
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
   * 根据ID获取群组
   * @param id 群组ID
   * @returns 群组信息或null
   */
  async getGroupById(id: string): Promise<ChatGroup | null> {
    const db = await this.ensureDb()
    const row = await db.get<ChatGroupRow>('SELECT * FROM chat_group WHERE id = ?', [id])
    return row ? convertGroupRow2Group(row) : null
  }

  /**
   * 根据ID获取群组(批量)
   * @param ids 群组ID数组
   * @returns 群组信息列表
   */
  async getGroupsByIds(ids: string[]): Promise<ChatGroup[]> {
    if (ids.length === 0) return []

    const db = await this.ensureDb()
    // 创建与ID数量匹配的占位符 (?, ?, ?)
    const placeholders = ids.map(() => '?').join(',')
    const rows = await db.all<ChatGroupRow[]>(`SELECT * FROM chat_group WHERE id IN (${placeholders})`, ids)

    return rows.map(convertGroupRow2Group)
  }

  /**
   * 获取指定创建者的所有群组
   * @param createUserId 创建者ID
   * @returns 群组列表
   */
  async getGroupsByCreator(createUserId: number): Promise<ChatGroup[]> {
    const db = await this.ensureDb()
    const rows = await db.all<ChatGroupRow[]>(
      'SELECT * FROM chat_group WHERE create_user = ? ORDER BY created_at DESC',
      [createUserId]
    )
    return rows.map(convertGroupRow2Group)
  }

  /**
   * 添加或更新 群组信息
   * @param groupInfo 群组信息
   * @returns
   */
  async addOrUpdateGroup(groupInfo: ChatGroup): Promise<void> {
    const db = await this.ensureDb()
    const existingGroup = await this.getGroupById(groupInfo.id)

    if (existingGroup) {
      // 更新现有群组
      await db.run(
        `
        UPDATE chat_group SET 
          name = ?, 
          create_user = ?, 
          avatar = ?, 
          signature = ?, 
          number = ?, 
          status = ?, 
          updated_at = ? 
        WHERE id = ?
      `,
        [
          groupInfo.name,
          groupInfo.createUser,
          groupInfo.avatar,
          groupInfo.signature,
          groupInfo.number,
          groupInfo.status,
          groupInfo.updatedAt,
          groupInfo.id
        ]
      )
    } else {
      // 插入新群组
      await db.run(
        `
        INSERT INTO chat_group (
          id, name, create_user, avatar, signature, number, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        [
          groupInfo.id,
          groupInfo.name,
          groupInfo.createUser,
          groupInfo.avatar,
          groupInfo.signature,
          groupInfo.number,
          groupInfo.status,
          groupInfo.createdAt,
          groupInfo.updatedAt
        ]
      )
    }
  }

  /**
   * 查询用户所在的所有群聊
   * @param userId 用户ID
   * @returns 群组ID列表
   */
  async getGroupIdsByUserId(userId: string): Promise<string[]> {
    const db = await this.ensureDb()
    const rows = await db.all<{ group_id: string }[]>(
      `SELECT group_id FROM group_member 
       WHERE user_id = ? AND status != 2`,
      [userId]
    )

    return rows.map((row) => row.group_id)
  }

  /**
   * 查询群聊中的所有用户
   * @param groupId 群组ID
   * @returns 用户ID列表
   */
  async getUserIdsByGroupId(groupId: string): Promise<string[]> {
    const db = await this.ensureDb()
    const rows = await db.all<{ user_id: string }[]>(
      `SELECT user_id FROM group_member 
       WHERE group_id = ? AND status != 2`,
      [groupId]
    )

    return rows.map((row) => row.user_id)
  }

  /**
   * 插入或更新群组成员
   * @param groupMember 群组成员信息
   * @returns
   */
  async addOrUpdateGroupMember(groupMember: GroupMember): Promise<void> {
    const db = await this.ensureDb()

    // 检查成员是否已存在
    const existingMember = await db.get<GroupMemberRow>(
      `SELECT * FROM group_member 
       WHERE group_id = ? AND user_id = ?`,
      [groupMember.groupId, groupMember.userId]
    )

    if (existingMember) {
      // 更新现有成员
      await db.run(
        `
        UPDATE group_member SET 
          remark = ?, 
          status = ?, 
          role = ?, 
          updated_at = ? 
        WHERE group_id = ? AND user_id = ?
      `,
        [
          groupMember.remark,
          groupMember.status,
          groupMember.role,
          groupMember.updatedAt,
          existingMember.group_id,
          existingMember.user_id
        ]
      )
    } else {
      // 插入新成员
      await db.run(
        `
        INSERT INTO group_member (
          group_id, user_id, remark, status, role, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
        [
          groupMember.groupId,
          groupMember.userId,
          groupMember.remark,
          groupMember.status,
          groupMember.role,
          groupMember.createdAt,
          groupMember.updatedAt
        ]
      )
    }
  }

  /**
   * 获取群组成员信息
   * @param groupId 群组ID
   * @param userId 用户ID
   * @returns 群组成员信息或null
   */
  async getGroupMemberByGroupIdAndUserId(
    groupId: string,
    userId: string
  ): Promise<GroupMember | null> {
    const db = await this.ensureDb()
    const row = await db.get<GroupMemberRow>(
      `SELECT * FROM  group_member
       WHERE group_id = ? AND user_id = ?`,
      [groupId, userId]
    )

    return row ? convertGroupMemberRow2GroupMember(row) : null
  }

  /**
   * 获取群组所有成员
   * @param groupId 群组ID
   * @returns 群组成员列表
   */
  async getGroupMembers(groupId: string): Promise<GroupMember[]> {
    const db = await this.ensureDb()
    const rows = await db.all<GroupMemberRow[]>(
      `SELECT * FROM group_member 
       WHERE group_id = ? AND status != 2
       ORDER BY role DESC, created_at ASC`,
      [groupId]
    )

    return rows.map(convertGroupMemberRow2GroupMember)
  }

  /**
   * 获取指定群组在【群组表（groups）】中的最晚更新时间
   * @param groupIds 群组ID列表（string[]）
   * @returns 最晚更新时间戳（number）- 无数据返回0，用于数据同步判断
   */
  async getGroupLatestUpdatedAt(groupIds: string[]): Promise<number> {
    const db = await this.ensureDb()

    // 边界处理：空列表直接返回0，避免无效查询
    if (groupIds.length === 0) return 0

    // 生成SQL占位符（?, ?, ...），适配多个群组ID
    const placeholders = groupIds.map(() => '?').join(',')

    // 查询逻辑：
    // 1. 筛选指定群组（group_id IN 列表）和有效状态（status=1，排除已删除群组）
    // 2. 用MAX(updated_at)获取最晚更新时间（如群名、头像、签名修改等）
    const result = await db.get<{ max_updated_at: number | null }>(
      `SELECT MAX(updated_at) AS max_updated_at 
       FROM chat_group 
       WHERE id IN (${placeholders})`,
      groupIds
    )

    // 无数据时返回0（同步场景默认值：0表示无更新或首次同步）
    return result?.max_updated_at ?? 0
  }

  /**
   * 获取指定群组在【群组成员表（group_member）】中的最晚更新时间
   * @param groupIds 群组ID列表（string[]）
   * @returns 最晚更新时间戳（number）- 无数据返回0，用于数据同步判断
   */
  async getGroupMemberLatestUpdatedAt(groupIds: string[]): Promise<number> {
    const db = await this.ensureDb()

    // 边界处理：空列表直接返回0
    if (groupIds.length === 0) return 0

    const placeholders = groupIds.map(() => '?').join(',')

    // 查询逻辑：
    // 1. 筛选指定群组（group_id IN 列表）和有效成员（status=1，排除已退出/拉黑成员）
    // 2. 用MAX(updated_at)获取最晚更新时间（如成员加入、角色变更、备注修改等）
    const result = await db.get<{ max_updated_at: number | null }>(
      `SELECT MAX(updated_at) AS max_updated_at 
       FROM group_member 
       WHERE group_id IN (${placeholders})`,
      groupIds
    )

    // 无数据返回0（如群组无成员，或成员全为无效状态）
    return result?.max_updated_at ?? 0
  }
}

export const groupDB = new GroupDB()
