import { ipcMain, IpcMainInvokeEvent } from 'electron'

// 定义严格的客户端数据类型
type ClientData = Record<string, unknown>

/**
 * 客户端数据存储类（单例模式）
 * 提供类型安全的键值存储功能
 */
export class ClientDataStore {
  private static instance: ClientDataStore
  private data: ClientData = {}

  /**
   * 获取单例实例
   */
  public static getInstance(): ClientDataStore {
    if (!ClientDataStore.instance) {
      ClientDataStore.instance = new ClientDataStore()
    }
    return ClientDataStore.instance
  }

  /**
   * 设置数据
   * @param key 存储键名
   * @param value 存储值
   */
  public set<T>(key: string, value: T): void {
    if (typeof key !== 'string' || key.trim().length === 0) {
      throw new Error('Invalid key: key must be a non-empty string')
    }
    console.log(`[ClientDataStore]: 保存数据[key: ${key}]`, value)
    this.data[key] = value
  }

  /**
   * 获取数据
   * @param key 要获取的键名
   * @returns 存储的值或undefined
   */
  public get<T>(key: string): T | undefined {
    if (!this.has(key)) {
      console.log(`[ClientDataStore]: 键不存在[key: ${key}]`)
      return undefined
    }
    const data = this.data[key] as T
    // console.log(`[ClientDataStore]: 返回数据[key: ${key}]`, data)
    return data
  }

  /**
   * 检查键是否存在
   * @param key 要检查的键名
   */
  public has(key: string): boolean {
    return Object.prototype.hasOwnProperty.call(this.data, key)
  }

  /**
   * 删除数据
   * @param key 要删除的键名
   * @returns 是否成功删除
   */
  public delete(key: string): boolean {
    if (!this.has(key)) {
      return false
    }
    delete this.data[key]
    console.log(`[ClientDataStore]: 删除数据[key: ${key}]`)
    return true
  }

  /**
   * 清空所有数据
   */
  public clear(): void {
    this.data = {}
    console.log('[ClientDataStore]: 清空所有数据')
  }

  /**
   * 获取所有键名
   */
  public keys(): string[] {
    return Object.keys(this.data)
  }
}

// 导出单例实例
export const clientDataStore = ClientDataStore.getInstance()

/**
 * 注册IPC处理器
 */
export function registerDataIpcHandlers(): void {
  // 获取数据
  ipcMain.handle('getClientData', <T>(_event: IpcMainInvokeEvent, key: string): T | undefined => {
    if (typeof key !== 'string') {
      throw new Error('Invalid key type')
    }
    return clientDataStore.get<T>(key)
  })

  // 设置数据
  ipcMain.handle(
    'setClientData',
    (_event: IpcMainInvokeEvent, key: string, value: unknown): boolean => {
      if (typeof key !== 'string') {
        throw new Error('Invalid key type')
      }
      clientDataStore.set(key, value)
      return true
    }
  )

  // 检查数据是否存在
  ipcMain.handle('hasClientData', (_event: IpcMainInvokeEvent, key: string): boolean => {
    if (typeof key !== 'string') {
      throw new Error('Invalid key type')
    }
    return clientDataStore.has(key)
  })

  // 删除数据
  ipcMain.handle('deleteClientData', (_event: IpcMainInvokeEvent, key: string): boolean => {
    if (typeof key !== 'string') {
      throw new Error('Invalid key type')
    }
    return clientDataStore.delete(key)
  })

  // 清空所有数据
  ipcMain.handle('clearClientData', (): void => {
    clientDataStore.clear()
  })
}
