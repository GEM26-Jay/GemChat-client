import * as net from 'net'
import { EventEmitter } from 'events'
import Protocol, { debugProtocal } from './protocol'
import { LengthFieldBasedFrameDecoder } from './frameDecoder'
import { registerClientHandler } from './handler'

interface ProtocolTcpClientConfig {
  host: string
  port: number
  reconnectDelay?: number
  heartbeatInterval?: number
  connectTimeout?: number
}

export const debugBuffer = (buffer: Buffer, groupSize = 8): void => {
  if (buffer.length === 0) {
    console.log('[Buffer Debug] 空缓冲区 (0 字节)')
    return
  }

  // 1. 打印基本信息
  console.log(`[Buffer Debug] 总长度: ${buffer.length} 字节`)

  // 2. 生成表格标题行
  const header = [
    '偏移量(十六进制)',
    ...Array.from({ length: groupSize }, (_, i) => i.toString(16).padStart(2, '0')),
    'ASCII 预览'
  ]
  console.table([header])

  // 3. 按分组大小拆分并打印内容
  for (let offset = 0; offset < buffer.length; offset += groupSize) {
    // 提取当前分组的字节
    const chunk = buffer.subarray(offset, offset + groupSize)

    // 偏移量（十六进制，固定4位）
    const offsetHex = offset.toString(16).padStart(4, '0')

    // 十六进制字节列（不足补空格）
    const hexColumns = Array.from(
      { length: groupSize },
      (_, i) => (i < chunk.length ? chunk[i].toString(16).padStart(2, '0') : '  ') // 空白填充
    )

    // ASCII 预览（可打印字符显示，否则显示 .）
    const asciiPreview = Array.from(chunk)
      .map((byte) => (byte >= 0x20 && byte <= 0x7e ? String.fromCharCode(byte) : '.'))
      .join('')

    // 生成一行数据并打印
    const row = [offsetHex, ...hexColumns, asciiPreview]
    console.table([row])
  }
}

export class ProtocolTcpClient extends EventEmitter {
  private config: Required<ProtocolTcpClientConfig>
  private client: net.Socket | null = null
  private connected: boolean = false
  private reconnectTimer: NodeJS.Timeout | null = null
  private heartbeatTimer: NodeJS.Timeout | null = null

  private frameDecoder = new LengthFieldBasedFrameDecoder({
    lengthFieldOffset: 32,
    lengthFieldLength: 2,
    lengthAdjustment: 0,
    initialBytesToStrip: 0
  })

  constructor(config: ProtocolTcpClientConfig) {
    super()
    this.config = {
      reconnectDelay: 3000,
      heartbeatInterval: 150000,
      connectTimeout: 10000,
      ...config
    }
  }

  private handleReceivedData(data: Buffer): void {
    try {
      console.log(`[TCP Client]: 接收消息`)
      // debugBuffer(data)
      const frame = this.frameDecoder.decode(data)
      if (!frame) return
      const protocol = Protocol.fromBuffer(frame)
      debugProtocal(protocol)
      if (protocol.hasType(Protocol.SYSTEM_PUSH)) {
        this.emit('system-push', protocol)
      } else if (protocol.hasType(Protocol.SYNC)) {
        this.emit('sync', protocol)
      } else if (protocol.hasType(Protocol.AUTH)) {
        this.emit('auth', protocol)
      } else {
        this.emit('message', protocol)
      }
    } catch (error) {
      this.emit('error', error instanceof Error ? error : new Error(String(error)))
    }
  }

  connect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    if (this.client) {
      this.client.destroy()
      this.client = null
    }

    this.client = new net.Socket()
    this.connected = false

    const connectTimeout = setTimeout(() => {
      this.emit('error', new Error('Connection timeout'))
      this.client?.destroy()
    }, this.config.connectTimeout)

    this.client.connect(this.config.port, this.config.host, () => {
      clearTimeout(connectTimeout)
      this.connected = true
      this.emit('connected')
      this.startHeartbeat()
    })

    this.client.on('data', (data: Buffer) => {
      this.handleReceivedData(data)
    })

    this.client.on('close', (hadError: boolean) => {
      clearTimeout(connectTimeout)
      this.stopHeartbeat()
      this.connected = false
      this.emit('disconnected', hadError)
      this.scheduleReconnect()
    })

    this.client.on('error', (err: Error) => {
      this.emit('error', err)
    })
  }

  sendProtocol(protocol: Protocol): boolean {
    if (!this.isConnected || !this.client) {
      this.emit('error', new Error('Not connected to server'))
      return false
    }

    try {
      const buffer = protocol.toBuffer()
      console.log(`[TCP Client]: 发送消息`)
      debugProtocal(protocol)
      // debugBuffer(buffer)
      this.client.write(buffer)
      return true
    } catch (err) {
      this.emit('error', err instanceof Error ? err : new Error(String(err)))
      return false
    }
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    this.stopHeartbeat()

    if (this.client) {
      this.client.destroy()
      this.client = null
    }

    this.connected = false
    this.emit('disconnected', false)
  }

  private startHeartbeat(): void {
    this.stopHeartbeat()

    this.heartbeatTimer = setInterval(() => {
      if (this.connected && this.client) {
        const heartbeat = new Protocol()
        heartbeat.setType(Protocol.HEART_BEAT)
        heartbeat.setFromId(0n)
        heartbeat.setToId(0n)
        heartbeat.setTimeStamp(BigInt(Date.now()))
        this.sendProtocol(heartbeat)
      }
    }, this.config.heartbeatInterval)
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  private scheduleReconnect(): void {
    if (!this.reconnectTimer) {
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null
        this.connect()
      }, this.config.reconnectDelay)
    }
  }

  isConnected(): boolean {
    return this.connected
  }
}

export const nettyClient = new ProtocolTcpClient({
  host: '127.0.0.1',
  port: 9200,
  reconnectDelay: 30000,
  heartbeatInterval: 150000,
  connectTimeout: 10000
})

registerClientHandler()
