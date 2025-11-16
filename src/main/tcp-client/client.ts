import * as net from 'net'
import { EventEmitter } from 'events'
import { LengthFieldBasedFrameDecoder } from './frameDecoder'
import Protocol, { debugProtocol, OrderMap } from './protocol'
import { getNettyServerAddress } from '@main/axios/axiosNettyApi'
import { registerNettyHandler } from './handler'

export interface ProtocolTcpClientConfig {
  host: string
  port: number
  reconnectDelay?: number
  connectTimeout?: number
}

export class ProtocolTcpClient extends EventEmitter {
  private config: Required<ProtocolTcpClientConfig>
  private client: net.Socket | null = null
  private connected = false
  private reconnectTimer: NodeJS.Timeout | null = null
  private timeoutTimer: NodeJS.Timeout | null = null

  private frameDecoder = new LengthFieldBasedFrameDecoder({
    lengthFieldOffset: Protocol.LENGTH_FIELD_BIAS,
    lengthFieldLength: 4,
    lengthAdjustment: 0,
    initialBytesToStrip: 0
  })

  constructor(config: ProtocolTcpClientConfig) {
    super()
    this.config = {
      reconnectDelay: 10000,
      connectTimeout: 10000,
      ...config
    }
  }

  private handleData(data: Buffer): void {
    try {
      console.log(`[TCP] 接收到数据 (${data.length} 字节)`)
      let frame = this.frameDecoder.decode(data)

      while (frame) {
        const protocol = Protocol.fromBuffer(frame)
        debugProtocol(protocol)

        const evt = OrderMap[protocol.getOrderType()]
        this.emit(evt || 'unknown-command', protocol)

        frame = this.frameDecoder.decode(Buffer.alloc(0))
      }
    } catch (err) {
      this.emit('error', err)
    }
  }

  connect(): void {
    this.clearTimers()
    this.connected = false

    this.client = new net.Socket()

    // 连接超时
    this.timeoutTimer = setTimeout(() => {
      const err = new Error(`连接超时 (${this.config.connectTimeout}ms)`)
      this.client?.destroy(err)
      this.emit('error', err)
    }, this.config.connectTimeout)

    this.client.connect(this.config.port, this.config.host, () => {
      this.clearTimers()
      this.connected = true
      this.emit('connected')
      console.log(`[TCP] 已连接到 ${this.config.host}:${this.config.port}`)
    })

    this.client.setKeepAlive(true, 5000)

    this.client.on('data', (data) => this.handleData(data))

    this.client.on('close', () => {
      this.connected = false
      this.emit('disconnected')
    })

    this.client.on('error', (err) => {
      this.emit('error', err)
    })
  }

  sendProtocol(protocol: Protocol): boolean {
    if (!this.connected || !this.client) {
      this.emit('error', new Error('客户端未连接'))
      return false
    }

    const buf = protocol.toBuffer()
    this.client.write(buf)
    return true
  }

  isConnected(): boolean {
    return this.connected
  }

  destroy(): void {
    this.clearTimers()
    this.client?.destroy()
    this.client = null
    this.connected = false
  }

  private clearTimers(): void {
    if (this.timeoutTimer) clearTimeout(this.timeoutTimer)
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.timeoutTimer = null
    this.reconnectTimer = null
  }
}

export class NettyClientManager extends EventEmitter {
  private static instance: NettyClientManager

  private client: ProtocolTcpClient | null = null
  private starting = false
  private address: { host: string; port: number } | null = null

  public static getInstance(): NettyClientManager {
    if (!NettyClientManager.instance) {
      NettyClientManager.instance = new NettyClientManager()
    }
    return NettyClientManager.instance
  }

  private constructor() {
    super()
  }

  /**
   * ================================
   * 主入口：启动（可重复调用但只执行一次）
   * ================================
   */
  public async start(): Promise<void> {
    if (this.starting) {
      console.log('[Netty] start() 已在执行中')
      return
    }
    this.starting = true

    while (true) {
      try {
        await this.fetchServerAddress()
        await this.createClient()
        this.client!.connect()
        break
      } catch (err) {
        console.error('[Netty] 启动失败，10 秒后重试:', err)
        await this.sleep(10000)
      }
    }
  }

  /**
   * 动态获取服务器地址
   */
  private async fetchServerAddress(): Promise<void> {
    while (true) {
      const res = await getNettyServerAddress()
      if (res.isSuccess && res.data) {
        const [host, portStr] = res.data.split(':')
        this.address = { host, port: Number(portStr) }
        console.log(`[Netty] 获取服务器地址成功: ${host}:${portStr}`)
        return
      }

      console.error('[Netty] 获取服务器地址失败，10 秒后重试')
      await this.sleep(10000)
    }
  }

  /**
   * 创建 TCP 客户端并绑定事件
   */
  private async createClient(): Promise<void> {
    if (!this.address) throw new Error('服务器地址为空')

    // 销毁旧连接
    if (this.client) {
      console.log('[Netty] 销毁旧 TCP Client')
      this.client.destroy()
    }

    console.log('[Netty] 初始化新的 TCP Client...')
    this.client = new ProtocolTcpClient({
      host: this.address.host,
      port: this.address.port,
      reconnectDelay: 10000
    })

    this.client.on('connected', () => {
      console.log('[Netty] TCP 已连接')
      this.emit('connected')
    })

    this.client.on('disconnected', async () => {
      console.warn('[Netty] TCP连接断开，重新获取服务器地址...')
      await this.fetchServerAddress()
      await this.createClient()
      this.client!.connect()
    })

    this.client.on('error', (err) => {
      console.error('[Netty] 客户端错误:', err)
      this.emit('error', err)
    })

    // 转发所有协议事件
    Object.values(OrderMap).forEach((evt) => {
      this.client!.on(evt, (protocol) => this.emit(evt, protocol))
    })
  }

  public sendProtocol(protocol: Protocol): boolean {
    if (!this.client) return false
    return this.client.sendProtocol(protocol)
  }

  private sleep(ms: number): Promise<unknown> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

export const nettyClientManager = NettyClientManager.getInstance()
registerNettyHandler(nettyClientManager)
