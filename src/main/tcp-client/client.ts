import * as net from 'net'
import { EventEmitter } from 'events'
import Protocol, { debugProtocal } from './protocol'
import { LengthFieldBasedFrameDecoder } from './frameDecoder'
import { getNettyServerAddress } from '../axios/axiosNettyApi'

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
    lengthFieldOffset: 40,
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
      let frame = this.frameDecoder.decode(data)
      while (frame) {
        const protocol = 
        Protocol.fromBuffer(frame)
        debugProtocal(protocol)
        if (protocol.getCommandType() === Protocol.ORDER_SYSTEM_PUSH) {
          this.emit('system-push', protocol)
        } else if (protocol.getCommandType() === Protocol.ORDER_SYNC) {
          this.emit('sync', protocol)
        } else if (protocol.getCommandType() === Protocol.ORDER_AUTH) {
          this.emit('auth', protocol)
        } else if (protocol.getCommandType() === Protocol.ORDER_MESSAGE) {
          this.emit('message', protocol)
        }
        frame = this.frameDecoder.decode(Buffer.alloc(0))
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
      // this.startHeartbeat()
    })

    this.client.setKeepAlive(true, 5000)

    this.client.on('data', (data: Buffer) => {
      this.handleReceivedData(data)
    })

    this.client.on('close', (hadError: boolean) => {
      clearTimeout(connectTimeout)
      // this.stopHeartbeat()
      this.connected = false
      this.emit('disconnected', hadError)
      // this.scheduleReconnect()
      this.disconnect()
      handleCloseOrError()
      console.log('[nettyClient] close')
    })

    this.client.on('error', (err: Error) => {
      this.emit('error', err)
      this.disconnect()
      handleCloseOrError()
      console.log('[nettyClient] error')
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

    // this.stopHeartbeat()

    if (this.client) {
      this.client.destroy()
      this.client = null
    }

    this.connected = false
    this.emit('disconnected', false)
  }

  private startHeartbeat(): void {
    // this.stopHeartbeat()

    this.heartbeatTimer = setInterval(() => {
      if (this.connected && this.client) {
        const heartbeat = new Protocol()
        heartbeat.setType(Protocol.ORDER_HEART_BEAT)
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

export const nettyClients = [] as ProtocolTcpClient[]

export const initNettyClient = async (): Promise<ProtocolTcpClient | null> => {
  try {
    const addrApi = await getNettyServerAddress()
    if (addrApi.isSuccess && addrApi.data) {
      const addr = addrApi.data
      console.log('Netty服务器地址:', addr)

      // 分割地址和端口
      const [host, portStr] = addr.split(':')

      // 验证地址格式
      if (!host || !portStr) {
        throw new Error('Netty地址格式异常，应为host:port形式')
      }

      // 转换端口为数字并验证
      const port = Number(portStr)
      if (isNaN(port) || port < 1 || port > 65535) {
        throw new Error(`无效的端口号: ${portStr}`)
      }

      const client = new ProtocolTcpClient({
        host,
        port,
        reconnectDelay: 30000,
        heartbeatInterval: 150000,
        connectTimeout: 10000
      })

      nettyClients.push(client)
      console.log('Netty客户端初始化成功')
      // 创建客户端实例
      return client
    } else {
      console.log('未能获取有效的Netty服务器地址')
    }
    return null
  } catch (error) {
    console.error(`初始化Netty客户端失败: ${error}`)
    throw error // 可以根据需要决定是否向上抛出错误
  }
}

const handleCloseOrError = (): void => {
  initNettyClient().then((result) => {
    if (result !== null) {
      nettyClients[0] = result
    } else {
      nettyClients.length = 0
    }
  })
}
