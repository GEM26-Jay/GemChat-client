import { ChatMessage } from '@shared/types'

// 等待ACK的消息容器（支持单条消息设置过期时间和回调）
export class WaitingAckContainer {
  // 存储结构：key -> { message: 消息对象, expireTime: 过期时间戳, onExpire: 过期回调 }
  private storage = new Map<
    string,
    {
      message: ChatMessage
      expireTime: number // 过期时间戳（毫秒）
      onExpire: () => void // 该消息的过期回调
    }
  >()

  // 定时清理器
  private cleaner: NodeJS.Timeout | null = null

  /**
   * 初始化容器
   * @param checkInterval 检查间隔（毫秒，默认10000ms）
   */
  constructor(private checkInterval: number = 10000) {
    this.startCleaner() // 启动清理器
  }

  /**
   * 存入消息（支持单独设置过期时间和过期回调）
   * @param key 唯一键（如 "sessionId:identityId"）
   * @param message 要存储的消息对象
   * @param waitMiles 等待时间（毫秒，多久后视为过期）
   * @param onExpire 该消息过期时的回调函数
   */
  set(key: string, message: ChatMessage, waitMiles: number, onExpire: () => void): void {
    this.storage.set(key, {
      message,
      expireTime: Date.now() + waitMiles, // 计算过期时间戳（当前时间 + 等待时间）
      onExpire // 过期回调
    })
  }

  /**
   * 根据key获取消息（获取后不会自动删除，需手动调用delete）
   * @param key 唯一键
   * @returns 消息对象（不存在则返回null）
   */
  get(key: string): ChatMessage | null {
    const item = this.storage.get(key)
    return item ? item.message : null
  }

  /**
   * 手动删除消息（收到ACK时调用）
   * @param key 唯一键
   */
  delete(key: string): void {
    this.storage.delete(key)
  }

  remove(key: string): ChatMessage | null {
    const item = this.get(key)
    if (item != null) {
      this.delete(key)
    }
    return item
  }

  /**
   * 启动定时清理器（检查所有消息是否过期）
   */
  private startCleaner(): void {
    // 先停止已有清理器，避免重复
    if (this.cleaner) {
      clearInterval(this.cleaner)
    }

    // 启动新的定时检查
    this.cleaner = setInterval(() => {
      const now = Date.now()
      // 遍历所有消息，检查是否过期
      this.storage.forEach((item, key) => {
        if (now >= item.expireTime) {
          // 触发该消息的过期回调
          item.onExpire()
          // 从容器中删除
          this.storage.delete(key)
        }
      })
    }, this.checkInterval)
  }

  /**
   * 停止定时清理器（销毁容器时调用）
   */
  destroy(): void {
    if (this.cleaner) {
      clearInterval(this.cleaner)
      this.cleaner = null
    }
    this.storage.clear() // 清空所有消息
  }
}

export const waitingAckContainer = new WaitingAckContainer()
