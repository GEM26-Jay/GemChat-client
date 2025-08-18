interface LengthFieldBasedFrameDecoderProps {
  lengthFieldOffset: number // 长度字段偏移量
  lengthFieldLength: number // 长度字段占用的字节数 (1, 2, 4, 8)
  lengthAdjustment: number // 长度调整值
  initialBytesToStrip: number // 跳过的初始字节数
  maxFrameLength?: number // 最大帧长度，用于防止内存溢出
}

export class LengthFieldBasedFrameDecoder {
  private props: LengthFieldBasedFrameDecoderProps
  private minLength: number
  private buffer: Buffer
  private maxFrameLength: number

  constructor(props: LengthFieldBasedFrameDecoderProps) {
    // 验证长度字段长度是否合法
    if (![1, 2, 4, 8].includes(props.lengthFieldLength)) {
      throw new Error(`不支持的长度字段长度: ${props.lengthFieldLength}，必须是1, 2, 4或8`)
    }

    // 验证初始跳过字节数是否合理
    if (props.initialBytesToStrip < 0) {
      throw new Error(`初始跳过字节数不能为负数: ${props.initialBytesToStrip}`)
    }

    this.props = props
    this.minLength = props.lengthFieldOffset + props.lengthFieldLength
    this.buffer = Buffer.alloc(0)
    this.maxFrameLength = props.maxFrameLength || 1024 * 1024 // 默认最大1MB
  }

  /**
   * 解码方法，处理输入数据并尝试提取完整帧
   * @param data 输入的二进制数据
   * @returns 完整的帧数据（null表示数据不完整）
   */
  decode = (data: Buffer): Buffer | null => {
    // 将新数据添加到缓冲区
    this.buffer = Buffer.concat([this.buffer, data])

    // 检查缓冲区数据是否足够读取长度字段
    if (this.buffer.byteLength < this.minLength) {
      return null
    }

    try {
      // 读取长度字段值
      const frameLength = this.readLengthField()

      // 检查帧长度是否超过最大限制
      if (frameLength > this.maxFrameLength) {
        throw new Error(`帧长度超过最大限制: ${frameLength} > ${this.maxFrameLength}`)
      }

      // 计算完整帧所需的总长度
      const totalFrameLength = this.minLength + frameLength + this.props.lengthAdjustment

      // 检查是否有足够的数据组成完整帧
      if (this.buffer.byteLength < totalFrameLength) {
        return null
      }

      // 提取完整帧（考虑需要跳过的初始字节）
      const start = this.props.initialBytesToStrip
      const end = totalFrameLength
      const frame = this.buffer.subarray(start, end)

      // 更新缓冲区，移除已处理的帧数据
      this.buffer = this.buffer.subarray(end)

      return frame
    } catch (error) {
      // 发生错误时清空缓冲区，防止错误数据影响后续解析
      this.buffer = Buffer.alloc(0)
      throw error // 抛出错误让调用者处理
    }
  }

  /**
   * 读取长度字段的值，支持不同长度类型
   * @returns 长度字段表示的数值
   */
  private readLengthField(): number {
    const { lengthFieldOffset, lengthFieldLength } = this.props

    switch (lengthFieldLength) {
      case 1:
        return this.buffer.readUInt8(lengthFieldOffset)
      case 2:
        return this.buffer.readUInt16BE(lengthFieldOffset) // 使用大端模式，与Java默认一致
      case 4:
        return this.buffer.readUInt32BE(lengthFieldOffset)
      case 8:
        return Number(this.buffer.readBigUInt64BE(lengthFieldOffset))
      default:
        throw new Error(`不支持的长度字段长度: ${lengthFieldLength}`)
    }
  }

  /**
   * 清空内部缓冲区，用于重置解码器状态
   */
  clearBuffer(): void {
    this.buffer = Buffer.alloc(0)
  }

  /**
   * 获取当前缓冲区中的数据长度
   * @returns 缓冲区字节数
   */
  getBufferLength(): number {
    return this.buffer.byteLength
  }
}
