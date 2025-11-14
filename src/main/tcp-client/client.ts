import * as net from 'net'
import { EventEmitter } from 'events'
import Protocol, { debugProtocol, OrderMap } from './protocol'
import { LengthFieldBasedFrameDecoder } from './frameDecoder'
import { registerNettyHandler } from './handler'

// 保留原buffer调试工具函数
export const debugBuffer = (buffer: Buffer, groupSize = 8): void => {
  if (buffer.length === 0) {
    console.log('[Buffer Debug] 空缓冲区 (0 字节)')
    return
  }

  console.log(`[Buffer Debug] 总长度: ${buffer.length} 字节`)

  const header = [
    '偏移量(十六进制)',
    ...Array.from({ length: groupSize }, (_, i) => i.toString(16).padStart(2, '0')),
    'ASCII 预览'
  ]
  console.table([header])

  for (let offset = 0; offset < buffer.length; offset += groupSize) {
    const chunk = buffer.subarray(offset, offset + groupSize)
    const offsetHex = offset.toString(16).padStart(4, '0')
    const hexColumns = Array.from({ length: groupSize }, (_, i) =>
      i < chunk.length ? chunk[i].toString(16).padStart(2, '0') : '  '
    )
    const asciiPreview = Array.from(chunk)
      .map((byte) => (byte >= 0x20 && byte <= 0x7e ? String.fromCharCode(byte) : '.'))
      .join('')
    const row = [offsetHex, ...hexColumns, asciiPreview]
    console.table([row])
  }
}

interface ProtocolTcpClientConfig {
  host: string
  port: number
  reconnectDelay?: number // 固定重连间隔(ms)，默认3000
  connectTimeout?: number // 连接超时(ms)，默认10000
}

export class ProtocolTcpClient extends EventEmitter {
  private config: Required<ProtocolTcpClientConfig>
  private client: net.Socket | null = null
  private connected: boolean = false
  private reconnectTimer: NodeJS.Timeout | null = null
  private connectTimeoutTimer: NodeJS.Timeout | null = null

  private frameDecoder = new LengthFieldBasedFrameDecoder({
    lengthFieldOffset: Protocol.LENGTH_FIELD_BIAS,
    lengthFieldLength: 4,
    lengthAdjustment: 0,
    initialBytesToStrip: 0
  })

  constructor(config: ProtocolTcpClientConfig) {
    super()
    this.config = {
      reconnectDelay: 10000, // 固定重连间隔（外部可自定义）
      connectTimeout: 10000,
      ...config
    }
  }

  /**
   * 处理接收到的TCP数据
   */
  private handleReceivedData(data: Buffer): void {
    try {
      console.log(`[TCP Client]: 接收消息 (${data.length} 字节)`)
      let frame: Buffer | null = this.frameDecoder.decode(data)

      while (frame) {
        const protocol = Protocol.fromBuffer(frame)
        debugProtocol(protocol)
        const orderType = protocol.getOrderType()
        const info = OrderMap[orderType]
        if (info) {
          this.emit(info, protocol)
        } else {
          console.error('TCP 收到 unknown-command')
          this.emit('unknown-command', protocol)
        }
        frame = this.frameDecoder.decode(Buffer.alloc(0))
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      console.error(`[TCP Client]: 数据解析失败: ${err.message}`)
      this.emit('error', err)
    }
  }

  /**
   * 建立TCP连接（初始化后调用，自动触发固定间隔重连）
   */
  connect(): void {
    // 清除现有重连定时器
    this.clearReconnectTimer()

    // 销毁现有连接（确保状态干净）
    if (this.client) {
      this.client.destroy()
      this.client = null
    }

    this.connected = false
    this.client = new net.Socket()

    // 连接超时处理
    this.connectTimeoutTimer = setTimeout(() => {
      const err = new Error(`连接超时 (${this.config.connectTimeout}ms)`)
      this.emit('error', err)
      this.client?.destroy(err) // 销毁连接触发重连
    }, this.config.connectTimeout)

    // 发起连接
    this.client.connect(this.config.port, this.config.host, () => {
      // 连接成功：清除超时、更新状态
      this.clearTimeoutTimer()
      this.connected = true
      this.emit('connected')
      console.log(`[TCP Client]: 已连接到 ${this.config.host}:${this.config.port}`)
    })

    // 启用TCP保活
    this.client.setKeepAlive(true, 5000)

    // 数据接收事件
    this.client.on('data', (data: Buffer) => {
      this.handleReceivedData(data)
    })

    // 连接关闭事件（无论何种原因关闭，均触发重连，直到成功）
    this.client.on('close', () => {
      this.clearTimeoutTimer()
      this.connected = false
      this.emit('disconnected')
      console.log(`[TCP Client]: 连接关闭，${this.config.reconnectDelay}ms后重试`)

      // 固定间隔重连（执行一次）
      this.reconnectTimer = setTimeout(() => {
        this.connect()
      }, this.config.reconnectDelay)
    })

    // 错误事件处理（仅打印，不影响重连逻辑）
    this.client.on('error', (err: Error) => {
      console.error(`[TCP Client]: 连接错误: ${err.message}`)
      this.emit('error', err)
    })
  }

  /**
   * 发送协议数据
   */
  sendProtocol(protocol: Protocol): boolean {
    if (!this.connected || !this.client) {
      this.emit('error', new Error('未连接到服务器，发送失败'))
      return false
    }

    try {
      const buffer = protocol.toBuffer()
      console.log(`[TCP Client]: 发送消息 (${buffer.length} 字节)`)
      debugProtocol(protocol)
      this.client.write(buffer)
      return true
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      console.error(error)
      this.emit('error', error)
      return false
    }
  }

  /**
   * 清除重连定时器
   */
  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  /**
   * 清除连接超时定时器
   */
  private clearTimeoutTimer(): void {
    if (this.connectTimeoutTimer) {
      clearTimeout(this.connectTimeoutTimer)
      this.connectTimeoutTimer = null
    }
  }

  /**
   * 检查当前连接状态
   */
  isConnected(): boolean {
    return this.connected
  }
}

// 全局唯一的Netty客户端管理器
export class NettyClientManager extends EventEmitter {
  private static instance: NettyClientManager
  private client: ProtocolTcpClient | null = null
  private initialized: boolean = false

  // 私有构造函数确保单例
  private constructor() {
    super()
  }

  // 获取全局唯一实例
  public static getInstance(): NettyClientManager {
    if (!NettyClientManager.instance) {
      NettyClientManager.instance = new NettyClientManager()
    }
    return NettyClientManager.instance
  }

  /**
   * 初始化Netty客户端（用户登录后调用）
   * @param host 可选：手动指定IP地址，不填则从接口获取
   * @param port 可选：手动指定端口，不填则从接口获取
   * @returns 是否初始化成功
   */
  public async initialize(host: string, port: number): Promise<boolean> {
    try {
      // 已初始化则先断开旧连接
      if (this.initialized) {
        return true
      }

      // 创建并连接客户端
      this.client = new ProtocolTcpClient({
        host: host,
        port: port,
        reconnectDelay: 10000,
        connectTimeout: 10000
      })

      // 转发客户端事件到管理器
      this.client.on('connected', () => {
        this.initialized = true
        this.emit('connected')
      })
      this.client.on('disconnected', (hadError) => {
        this.initialized = false
        this.emit('disconnected', hadError)
      })
      this.client.on('error', (err) => {
        this.emit('error', err)
      })
      // 自定义命令
      this.client.on(OrderMap[Protocol.ORDER_SYSTEM], (protocol) => {
        this.emit(OrderMap[Protocol.ORDER_SYSTEM], protocol)
      })
      this.client.on(OrderMap[Protocol.ORDER_SYNC], (protocol) => {
        this.emit(OrderMap[Protocol.ORDER_SYNC], protocol)
      })
      this.client.on(OrderMap[Protocol.ORDER_AUTH], (protocol) => {
        this.emit(OrderMap[Protocol.ORDER_AUTH], protocol)
      })
      this.client.on(OrderMap[Protocol.ORDER_MESSAGE], (protocol) => {
        this.emit(OrderMap[Protocol.ORDER_MESSAGE], protocol)
      })
      this.client.on(OrderMap[Protocol.ORDER_ACK], (protocol) => {
        this.emit(OrderMap[Protocol.ORDER_ACK], protocol)
      })
      // 未知异常命令
      this.client.on('unknow', (protocol) => {
        this.emit(OrderMap[Protocol.ORDER_ACK], protocol)
      })
      // 启动连接
      this.client.connect()
      return true
    } catch (error) {
      console.error(
        `Netty客户端初始化失败: ${error instanceof Error ? error.message : String(error)}`
      )
      this.emit('error', error)
      this.initialized = false
      return false
    }
  }

  /**
   * 发送协议数据
   * @param protocol 要发送的协议对象
   * @returns 是否发送成功
   */
  public sendProtocol(protocol: Protocol): boolean {
    if (!this.client || !this.isConnected()) {
      this.emit('error', new Error('客户端未连接'))
      return false
    }
    return this.client.sendProtocol(protocol)
  }

  /**
   * 检查是否已连接
   * @returns 连接状态
   */
  public isConnected(): boolean {
    return this.client?.isConnected() ?? false
  }

  /**
   * 检查是否已初始化
   * @returns 初始化状态
   */
  public isInitialized(): boolean {
    return this.initialized
  }
}

// 导出全局唯一实例
export const nettyClientManager = NettyClientManager.getInstance()
registerNettyHandler(nettyClientManager)
