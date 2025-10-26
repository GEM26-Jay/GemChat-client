import { Buffer } from 'buffer'

/**
 * Custom protocol class for network communication data encapsulation and parsing
 */
export default class Protocol {
  // 命令类型常量（高16位）
  public static readonly ORDER_SYSTEM_PUSH = 1 << 16 // 系统推送
  public static readonly ORDER_AUTH = 2 << 16 // 认证
  public static readonly ORDER_SYNC = 3 << 16 // 同步信号
  public static readonly ORDER_HEART_BEAT = 4 << 16 // 心跳
  public static readonly ORDER_MESSAGE = 5 << 16 // 消息转发

  // 内容类型（低16位）
  public static readonly CONTENT_FAILED_INFO = -1 // 发送失败响应
  public static readonly CONTENT_TEXT = 1 // 文本消息
  public static readonly CONTENT_IMAGE = 2 // 图片消息
  public static readonly CONTENT_FILE = 3 // 文件消息
  public static readonly CONTENT_VOICE = 4 // 语音消息
  public static readonly CONTENT_VIDEO = 5 // 视频消息
  public static readonly CONTENT_LOCATION = 6 // 位置消息
  public static readonly CONTENT_ACK = 99 // 消息响应


  // Protocol magic number (2 bytes, for packet validation)
  public static readonly MAGIC_NUMBER = 0xbabe

  // Protocol version (2 bytes), default 1
  private version: number = 1
  // Message command type (高16位命令类型 + 低16位内容类型, 4 bytes)
  private type: number = 0
  // Sender ID (8 bytes)
  private fromId: bigint = 0n
  // Receiver ID (8 bytes)
  private toId: bigint = 0n
  // 唯一标识符
  private identityId: bigint = 0n
  // Timestamp (8 bytes)
  private timeStamp: bigint = 0n
  // Message body length (2 bytes)
  private length: number = 0
  // Message body content (UTF-8 encoded bytes)
  private message: Buffer = Buffer.alloc(0)

  /**
   * Calculate message length and update length field
   */
  public calculateLength(): void {
    this.length = this.message?.length ?? 0
  }

  /**
   * Get message as string (UTF-8 decoded)
   */
  public getMessageString(): string {
    return this.message?.toString('utf-8') ?? ''
  }

  /**
   * Set message from string (UTF-8 encoded) or Buffer
   */
  public setMessage(message: string | Buffer | Uint8Array): void {
    if (typeof message === 'string') {
      this.message = Buffer.from(message, 'utf-8')
    } else if (message instanceof Uint8Array) {
      this.message = Buffer.from(message)
    } else {
      this.message = message ?? Buffer.alloc(0)
    }
    this.calculateLength()
  }

  /**
   * Get message as Buffer (ensures non-null)
   */
  public getMessageBuffer(): Buffer {
    return this.message ?? Buffer.alloc(0)
  }

  // Getters and setters
  public getVersion(): number {
    return this.version
  }
  public setVersion(version: number): void {
    this.version = version
  }

  public getType(): number {
    return this.type
  }
  public setType(type: number): void {
    this.type = type
  }

  /**
   * 设置完整类型（命令类型 + 内容类型）
   */
  public setFullType(commandType: number, contentType: number): void {
    // 确保命令类型只占用高16位，内容类型占用低16位
    this.type = (commandType & 0xffff0000) | (contentType & 0x0000ffff)
  }

  /**
   * 获取命令类型（高16位）
   */
  public getCommandType(): number {
    return this.type & 0xffff0000
  }

  /**
   * 获取内容类型（低16位）
   */
  public getContentType(): number {
    return this.type & 0x0000ffff
  }

  public getFromId(): bigint {
    return this.fromId
  }
  public setFromId(fromId: bigint): void {
    this.fromId = fromId
  }

  public getToId(): bigint {
    return this.toId
  }
  public setToId(toId: bigint): void {
    this.toId = toId
  }

  public getIdentityId(): bigint {
    return this.identityId
  }
  public setIdentityId(identityId: bigint): void {
    this.identityId = identityId
  }

  public getTimeStamp(): bigint {
    return this.timeStamp
  }
  public setTimeStamp(timeStamp: bigint): void {
    this.timeStamp = timeStamp
  }

  public getLength(): number {
    return this.length
  }
  public setLength(length: number): void {
    this.length = length
  }

  /**
   * Serialize protocol to Buffer
   */
  public toBuffer(): Buffer {
    this.calculateLength()

    // Create a Buffer with exact size needed
    const buffer = Buffer.alloc(2 + 2 + 4 + 8 + 8 + 8 + 8 + 2 + this.length)

    let offset = 0

    // Write fields in protocol order
    buffer.writeUInt16BE(Protocol.MAGIC_NUMBER, offset)
    offset += 2
    buffer.writeUInt16BE(this.version, offset)
    offset += 2
    buffer.writeInt32BE(this.type, offset)
    offset += 4
    buffer.writeBigUInt64BE(this.fromId, offset)
    offset += 8
    buffer.writeBigUInt64BE(this.toId, offset)
    offset += 8
    buffer.writeBigUInt64BE(this.identityId, offset)
    offset += 8
    buffer.writeBigUInt64BE(this.timeStamp, offset)
    offset += 8
    buffer.writeUInt16BE(this.length, offset)
    offset += 2

    // Write message if length > 0
    if (this.length > 0) {
      this.message.copy(buffer, offset, 0, this.length)
    }

    return buffer
  }

  /**
   * Deserialize from Buffer to Protocol object
   */
  public static fromBuffer(buffer: Buffer): Protocol {
    const protocol = new Protocol()
    let offset = 0

    // Verify magic number
    const magic = buffer.readUInt16BE(offset)
    if (magic !== Protocol.MAGIC_NUMBER) {
      throw new Error(
        `Protocol magic number validation failed, expected: 0x${Protocol.MAGIC_NUMBER.toString(16)}, actual: 0x${magic.toString(16)}`
      )
    }
    offset += 2

    // Read fixed fields
    protocol.setVersion(buffer.readUInt16BE(offset))
    offset += 2
    protocol.setType(buffer.readInt32BE(offset))
    offset += 4
    protocol.setFromId(buffer.readBigUInt64BE(offset))
    offset += 8
    protocol.setToId(buffer.readBigUInt64BE(offset))
    offset += 8
    protocol.setIdentityId(buffer.readBigUInt64BE(offset))
    offset += 8
    protocol.setTimeStamp(buffer.readBigUInt64BE(offset))
    offset += 8
    protocol.setLength(buffer.readUInt16BE(offset))
    offset += 2

    // Read message body
    const msgLength = protocol.getLength()
    if (msgLength > 0) {
      if (msgLength < 0 || offset + msgLength > buffer.length) {
        throw new Error(
          `Message length abnormal, declared: ${msgLength}, available bytes: ${buffer.length - offset}`
        )
      }
      protocol.setMessage(buffer.slice(offset, offset + msgLength))
    } else {
      protocol.setMessage(Buffer.alloc(0))
    }

    return protocol
  }
}

export const debugProtocal = (protocol: Protocol): void => {
  console.log('=== Protocol Debug Info ===')

  // 基本信息
  console.log(`Magic Number: 0x${Protocol.MAGIC_NUMBER.toString(16)}`)
  console.log(`Version: ${protocol.getVersion()}`)

  // 解析命令类型和内容类型
  const commandType = protocol.getCommandType()
  const contentType = protocol.getContentType()

  let systemCmdStr = ''
  switch (commandType) {
    case Protocol.ORDER_SYSTEM_PUSH:
      systemCmdStr = 'SYSTEM_PUSH'
      break
    case Protocol.ORDER_AUTH:
      systemCmdStr = 'AUTH'
      break
    case Protocol.ORDER_SYNC:
      systemCmdStr = 'SYNC'
      break
    case Protocol.ORDER_HEART_BEAT:
      systemCmdStr = 'HEART_BEAT'
      break
    case Protocol.ORDER_MESSAGE:
      systemCmdStr = 'MESSAGE'
      break
    default:
      systemCmdStr = `UNKNOWN(0x${commandType.toString(16)})`
  }

  let contentTypeStr = ''
  switch (contentType) {
    case Protocol.CONTENT_FAILED_INFO:
      contentTypeStr = 'FAILED_INFO'
      break
    case Protocol.CONTENT_TEXT:
      contentTypeStr = 'TEXT'
      break
    case Protocol.CONTENT_FILE:
      contentTypeStr = 'FILE'
      break
    case Protocol.CONTENT_ACK:
      contentTypeStr = 'ACK'
      break
    default:
      contentTypeStr = `UNKNOWN(0x${contentType.toString(16)})`
  }

  console.log(`Type: 0x${protocol.getType().toString(16)}`)
  console.log(`  Command Type: 0x${commandType.toString(16)} (${systemCmdStr})`)
  console.log(`  Content Type: 0x${contentType.toString(16)} (${contentTypeStr})`)

  // ID 和时间戳（使用字符串形式显示大整数）
  console.log(`From ID: ${protocol.getFromId().toString()}`)
  console.log(`To ID: ${protocol.getToId().toString()}`)
  console.log(`Timestamp: ${protocol.getTimeStamp().toString()}`)

  // 消息内容
  console.log(`Message Length: ${protocol.getLength()}`)
  console.log(`Message Content (string): "${protocol.getMessageString()}"`)
  // console.log(`Message Content (hex): 0x${protocol.getMessageBuffer().toString('hex')}`)

  console.log('==========================')
}
