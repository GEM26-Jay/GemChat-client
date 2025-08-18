import { Buffer } from 'buffer'

/**
 * Custom protocol class for network communication data encapsulation and parsing
 */
export default class Protocol {
  // Command type constants (high 16 bits: system commands)
  public static readonly SYSTEM_PUSH = 1 << 16 // System push command
  public static readonly AUTH = 2 << 16 // Authentication command
  public static readonly SYNC = 3 << 16 // Sync command
  public static readonly HEART_BEAT = 4 << 16 // HEART BEAT

  // Target type constants (middle 8 bits: receiver type)
  public static readonly TO_USER = 1 << 8 // Single chat (0x00000100)
  public static readonly TO_GROUP = 2 << 8 // Group chat (0x00000200)

  // Content type constants (low 8 bits: message type)
  public static readonly MESSAGE = 1 // Text message (0x00000001)
  public static readonly FILE = 2 // File message (0x00000002)

  // Protocol magic number (2 bytes, for packet validation)
  public static readonly MAGIC_NUMBER = 0xbabe

  // Protocol version (2 bytes), default 1
  private version: number = 1
  // Message command type (high 16 + middle 8 + low 8 bits, 4 bytes)
  private type: number = 0
  // Sender ID (8 bytes)
  private fromId: bigint = 0n
  // Receiver ID (8 bytes)
  private toId: bigint = 0n
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
    const buffer = Buffer.alloc(2 + 2 + 4 + 8 + 8 + 8 + 2 + this.length)

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

  /**
   * Check if current type contains target flag
   * @param target Flag to check (e.g., SYSTEM_PUSH, TO_USER, etc.)
   * @returns true if contains target flag, otherwise false
   */
  public hasType(target: number): boolean {
    // 将32位type和target分解为4个8位段
    const typeSegments = [
      (this.type >>> 24) & 0xff, // 最高8位（系统命令段）
      (this.type >>> 16) & 0xff, // 次高8位（保留段）
      (this.type >>> 8) & 0xff, // 中间8位（目标类型段）
      this.type & 0xff // 最低8位（内容类型段）
    ]

    const targetSegments = [
      (target >>> 24) & 0xff,
      (target >>> 16) & 0xff,
      (target >>> 8) & 0xff,
      target & 0xff
    ]

    // 逐段验证
    for (let i = 0; i < 4; i++) {
      if (targetSegments[i] !== 0) {
        // 如果target段非0
        if (typeSegments[i] !== targetSegments[i]) {
          return false
        }
      }
    }

    return true
  }
}

export const debugProtocal = (protocol: Protocol): void => {
  console.log('=== Protocol Debug Info ===')

  // 基本信息
  console.log(`Magic Number: 0x${Protocol.MAGIC_NUMBER.toString(16)}`)
  console.log(`Version: ${protocol.getVersion()}`)

  // 解析命令类型
  const type = protocol.getType()
  const systemCmd = type & 0xffff0000
  const targetType = type & 0x0000ff00
  const contentType = type & 0x000000ff

  let systemCmdStr = ''
  switch (systemCmd) {
    case Protocol.SYSTEM_PUSH:
      systemCmdStr = 'SYSTEM_PUSH'
      break
    case Protocol.AUTH:
      systemCmdStr = 'AUTH'
      break
    case Protocol.SYNC:
      systemCmdStr = 'SYNC'
      break
    case Protocol.HEART_BEAT:
      systemCmdStr = 'HEART_BEAT'
      break
    default:
      systemCmdStr = `UNKNOWN(0x${systemCmd.toString(16)})`
  }

  let targetTypeStr = ''
  switch (targetType) {
    case Protocol.TO_USER:
      targetTypeStr = 'TO_USER'
      break
    case Protocol.TO_GROUP:
      targetTypeStr = 'TO_GROUP'
      break
    default:
      targetTypeStr = `UNKNOWN(0x${targetType.toString(16)})`
  }

  let contentTypeStr = ''
  switch (contentType) {
    case Protocol.MESSAGE:
      contentTypeStr = 'MESSAGE'
      break
    case Protocol.FILE:
      contentTypeStr = 'FILE'
      break
    default:
      contentTypeStr = `UNKNOWN(0x${contentType.toString(16)})`
  }

  console.log(
    `Type: 0x${type.toString(16)} (${systemCmdStr} | ${targetTypeStr} | ${contentTypeStr})`
  )

  // ID 和时间戳（使用字符串形式显示大整数）
  console.log(`From ID: ${protocol.getFromId().toString()}`)
  console.log(`To ID: ${protocol.getToId().toString()}`)
  console.log(`Timestamp: ${protocol.getTimeStamp().toString()}`)

  // 消息内容
  console.log(`Message Length: ${protocol.getLength()}`)
  console.log(`Message Content (string): "${protocol.getMessageString()}"`)
  console.log(`Message Content (hex): 0x${protocol.getMessageBuffer().toString('hex')}`)

  console.log('==========================')
}
