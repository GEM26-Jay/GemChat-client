import { Buffer } from 'buffer'

/**
 * 自定义协议类（与后端同步），用于网络通信的数据封装与解析
 */
export default class Protocol {
  // 命令类型常量（高16位）- 与后端同步
  public static readonly ORDER_SYSTEM = 1 << 16 // 系统推送
  public static readonly ORDER_AUTH = 2 << 16 // 认证命令
  public static readonly ORDER_SYNC = 3 << 16 // 同步命令
  public static readonly ORDER_MESSAGE = 4 << 16 // 消息命令
  public static readonly ORDER_ACK = 5 << 16 // 消息响应

  // 内容类型（低16位）- 与后端同步
  public static readonly CONTENT_FAILED = -1 // 失败响应
  public static readonly CONTENT_EMPTY = 0 // 空消息(无意义)
  public static readonly CONTENT_TEXT = 1 // 字符串文本
  public static readonly CONTENT_IMAGE = 2 // 图片消息
  public static readonly CONTENT_AUDIO = 3 // 语音消息
  public static readonly CONTENT_VIDEO = 4 // 视频消息
  public static readonly CONTENT_OTHER_FILE = 5 // 其他文件类型
  public static readonly CONTENT_LOCATION = 6 // 位置消息

  public static readonly LENGTH_FIELD_BIAS = 48

  // 协议魔数（2字节，与后端保持一致）
  public static readonly MAGIC_NUMBER = 0xbabe

  // 协议字段（与后端字段名完全同步）
  version: number = 1 // 版本号（2字节）
  type: number = 0 // 类型（4字节：高16位命令+低16位内容）
  fromId: bigint = 0n // 发送方ID（8字节）
  identityId: bigint = 0n // 消息标识（8字节）
  sessionId: bigint = 0n // 目标会话ID（原toId同步为sessionId）
  messageId: bigint = 0n // 消息ID（新增字段，与后端同步）
  timeStamp: bigint = 0n // 时间戳（8字节）
  length: number = 0 // 消息体长度（4字节，与后端保持一致）
  content: Buffer = Buffer.alloc(0) // 消息体内容（原message同步为content）

  /**
   * 计算消息体长度并更新length字段
   */
  calculateLength(): void {
    this.length = this.content.length
  }

  /**
   * 获取消息体的字符串形式（UTF-8解码）
   */
  getContentString(): string {
    return this.content.toString('utf-8')
  }

  /**
   * 设置消息体内容（支持字符串、Buffer或Uint8Array）
   */
  setContent(data: string | Buffer | Uint8Array): void {
    if (typeof data === 'string') {
      this.content = Buffer.from(data, 'utf-8')
    } else {
      this.content = Buffer.from(data)
    }
    this.calculateLength()
  }

  /**
   * 设置完整类型（命令类型+内容类型）
   */
  setFullType(orderType: number, contentType: number): void {
    this.type = (orderType & 0xffff0000) | (contentType & 0x0000ffff)
  }

  /**
   * 获取命令类型（高16位）
   */
  getOrderType(): number {
    return this.type & 0xffff0000
  }

  /**
   * 获取内容类型（低16位）
   */
  getContentType(): number {
    return this.type & 0x0000ffff
  }

  /**
   * 序列化协议为Buffer（与后端字段顺序完全一致）
   */
  toBuffer(): Buffer {
    this.calculateLength()
    // 固定头部长度：2+2+4+8+8+8+8+8+4 = 52字节（与后端同步）
    const totalLength = 52 + this.length
    const buffer = Buffer.alloc(totalLength)
    let offset = 0

    // 按后端顺序写入字段
    buffer.writeUInt16BE(Protocol.MAGIC_NUMBER, offset)
    offset += 2
    buffer.writeUInt16BE(this.version, offset)
    offset += 2
    buffer.writeInt32BE(this.type, offset)
    offset += 4
    buffer.writeBigUInt64BE(this.fromId, offset)
    offset += 8
    buffer.writeBigUInt64BE(this.identityId, offset)
    offset += 8
    buffer.writeBigUInt64BE(this.sessionId, offset)
    offset += 8
    buffer.writeBigUInt64BE(this.messageId, offset)
    offset += 8
    buffer.writeBigUInt64BE(this.timeStamp, offset)
    offset += 8
    buffer.writeInt32BE(this.length, offset)
    offset += 4

    // 写入消息体
    if (this.length > 0) {
      this.content.copy(buffer, offset, 0, this.length)
    }

    return buffer
  }

  /**
   * 从Buffer反序列化为Protocol实例（与后端解析逻辑同步）
   */
  static fromBuffer(buffer: Buffer): Protocol {
    const protocol = new Protocol()
    let offset = 0

    // 验证魔数
    const magic = buffer.readUInt16BE(offset)
    if (magic !== Protocol.MAGIC_NUMBER) {
      throw new Error(
        `协议魔数验证失败，预期: 0x${Protocol.MAGIC_NUMBER.toString(16)}, 实际: 0x${magic.toString(16)}`
      )
    }
    offset += 2

    // 按后端顺序读取字段
    protocol.version = buffer.readUInt16BE(offset)
    offset += 2
    protocol.type = buffer.readInt32BE(offset)
    offset += 4
    protocol.fromId = buffer.readBigUInt64BE(offset)
    offset += 8
    protocol.identityId = buffer.readBigUInt64BE(offset)
    offset += 8
    protocol.sessionId = buffer.readBigUInt64BE(offset)
    offset += 8
    protocol.messageId = buffer.readBigUInt64BE(offset)
    offset += 8
    protocol.timeStamp = buffer.readBigUInt64BE(offset)
    offset += 8
    protocol.length = buffer.readInt32BE(offset) // 长度字段改为4字节
    offset += 4

    // 读取消息体
    if (protocol.length > 0) {
      if (offset + protocol.length > buffer.length) {
        throw new Error(
          `消息体长度异常，声明: ${protocol.length}, 可用字节: ${buffer.length - offset}`
        )
      }
      protocol.content = buffer.slice(offset, offset + protocol.length)
    }

    return protocol
  }
}

// 命令类型映射
export const OrderMap: Record<number, string> = {
  [Protocol.ORDER_SYSTEM]: 'SYSTEM',
  [Protocol.ORDER_AUTH]: 'AUTH',
  [Protocol.ORDER_SYNC]: 'SYNC',
  [Protocol.ORDER_MESSAGE]: 'MESSAGE',
  [Protocol.ORDER_ACK]: 'ACK'
}

// 内容类型映射
export const ContentMap: Record<number, string> = {
  [Protocol.CONTENT_FAILED]: 'FAILED',
  [Protocol.CONTENT_EMPTY]: 'EMPTY',
  [Protocol.CONTENT_TEXT]: 'TEXT',
  [Protocol.CONTENT_IMAGE]: 'IMAGE',
  [Protocol.CONTENT_AUDIO]: 'AUDIO',
  [Protocol.CONTENT_VIDEO]: 'VIDEO',
  [Protocol.CONTENT_OTHER_FILE]: 'OTHER_FILE',
  [Protocol.CONTENT_LOCATION]: 'LOCATION'
}

/**
 * 协议调试信息打印（与后端字段对应）
 */
export const debugProtocol = (protocol: Protocol): void => {
  console.log('=== 协议调试信息 ===')
  console.log(`魔数: 0x${Protocol.MAGIC_NUMBER.toString(16)}`)
  console.log(`版本: ${protocol.version}`)

  // 解析类型
  const orderType = protocol.getOrderType()
  const contentType = protocol.getContentType()

  console.log(`类型: 0x${protocol.type.toString(16)}`)
  console.log(`  命令类型: 0x${orderType.toString(16)} (${OrderMap[orderType] || 'UNKNOWN'})`)
  console.log(`  内容类型: 0x${contentType.toString(16)} (${ContentMap[contentType] || 'UNKNOWN'})`)
  console.log(`发送方ID: ${protocol.fromId.toString()}`)
  console.log(`消息标识: ${protocol.identityId.toString()}`)
  console.log(`会话ID: ${protocol.sessionId.toString()}`)
  console.log(`消息ID: ${protocol.messageId.toString()}`)
  console.log(`时间戳: ${protocol.timeStamp.toString()}`)
  console.log(`消息长度: ${protocol.length}`)
  console.log(`消息内容: "${protocol.getContentString()}"`)
  console.log('====================')
}
