/** MIME类型枚举 */
export type MIME =
  // 图片
  | 'image/jpeg'
  | 'image/png'
  | 'image/gif'
  | 'image/bmp'
  | 'image/webp'
  | 'image/svg+xml'
  // 文档
  | 'text/plain'
  | 'text/html'
  | 'text/css'
  | 'text/javascript'
  | 'application/json'
  | 'application/pdf'
  | 'application/msword'
  | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  | 'application/vnd.ms-excel'
  | 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  | 'application/vnd.ms-powerpoint'
  | 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  // 压缩文件
  | 'application/zip'
  | 'application/gzip'
  | 'application/x-tar'
  | 'application/x-7z-compressed'
  // 其他
  | 'application/octet-stream'
  | 'audio/mpeg'
  | 'video/mp4'
  | 'video/mpeg'
  | 'font/ttf'
  | 'font/woff'
  | 'font/woff2'

export const extensionToMIME: Record<string, MIME> = {
  // 图片
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  bmp: 'image/bmp',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  // 文本/代码
  txt: 'text/plain',
  html: 'text/html',
  css: 'text/css',
  js: 'text/javascript',
  json: 'application/json',
  // 文档
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  // 压缩文件
  zip: 'application/zip',
  gz: 'application/gzip',
  tar: 'application/x-tar',
  '7z': 'application/x-7z-compressed',
  // 音视频
  mp3: 'audio/mpeg',
  mp4: 'video/mp4',
  mpeg: 'video/mpeg',
  // 字体
  ttf: 'font/ttf',
  woff: 'font/woff',
  woff2: 'font/woff2'
}

/**
 * 根据文件名获取 MIME 类型
 */
export function getMIMEFromFilename(filename: string): MIME {
  if (!filename) return 'application/octet-stream'

  const lastDotIndex = filename.lastIndexOf('.')
  if (lastDotIndex === -1) return 'application/octet-stream'

  const extension = filename.slice(lastDotIndex + 1).toLowerCase()
  return extensionToMIME[extension] || 'application/octet-stream'
}

/** 格式化文件大小 */
export const formatFileSize = (size: number): string => {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

/** File转Base64 */
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.readAsDataURL(file)
  })
}

/** File转ArrayBuffer */
export const fileToBuffer = async (file: File): Promise<ArrayBuffer> => {
  return await file.arrayBuffer()
}

/** 格式化时间戳为日期 */
export const formatDate = (timestamp: number): string => {
  return new Date(timestamp).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

/**
 * 统一的文件指纹计算函数（浏览器环境，流式分片处理）
 * 支持File对象、Base64字符串和ArrayBuffer输入，大文件无完整内存占用
 * File对象只能在浏览器中使用，Node环境无File对象
 */
export const calculateFileFingerprintByContent = async (
  input: File | string | ArrayBuffer
): Promise<string> => {
  try {
    if (input instanceof File) {
      // 大文件：流式分片计算哈希（核心优化）
      return calculateFileHashInChunks(input)
    } else if (typeof input === 'string') {
      // 处理Base64字符串
      const base64WithoutPrefix = input.replace(/^data:[^;]+;base64,/, '')
      const binaryString = atob(base64WithoutPrefix)
      const uint8Array = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        uint8Array[i] = binaryString.charCodeAt(i)
      }
      return calculateSha256(uint8Array.buffer)
    } else if (input instanceof ArrayBuffer) {
      // 直接计算ArrayBuffer的哈希
      return calculateSha256(input)
    } else {
      throw new Error('不支持的输入类型，支持File对象、Base64字符串和ArrayBuffer')
    }
  } catch (error) {
    console.error('计算文件指纹失败:', error)
    throw new Error('无法计算文件指纹，请重试')
  }
}

/**
 * 浏览器标准流式分片计算文件哈希（无额外依赖）
 * 原理：每次读取分片后，用当前分片更新临时哈希，最终合并所有分片的哈希影响
 */
async function calculateFileHashInChunks(file: File): Promise<string> {
  const chunkSize = 64 * 1024 // 64KB分片
  const totalChunks = Math.ceil(file.size / chunkSize)
  let accumulatedHash: ArrayBuffer | null = null // 累加的哈希状态

  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize
    const end = Math.min(start + chunkSize, file.size)
    const chunk = await file.slice(start, end).arrayBuffer() // 读取当前分片

    if (!accumulatedHash) {
      // 第一次计算：直接用当前分片
      accumulatedHash = await crypto.subtle.digest('SHA-256', chunk)
    } else {
      // 后续计算：将上一次的哈希结果与当前分片合并后再计算
      const combined = new Uint8Array(accumulatedHash.byteLength + chunk.byteLength)
      combined.set(new Uint8Array(accumulatedHash), 0) // 前半部分：上一次的哈希
      combined.set(new Uint8Array(chunk), accumulatedHash.byteLength) // 后半部分：当前分片
      accumulatedHash = await crypto.subtle.digest('SHA-256', combined.buffer)
    }
  }

  // 转换为十六进制字符串
  return Array.from(new Uint8Array(accumulatedHash!))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * 计算ArrayBuffer的SHA-256哈希（小数据专用）
 */
async function calculateSha256(arrayBuffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer)
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * 简单生成UUID
 * @returns string
 */
export function generateUUID(): string {
  // 1. 获取当前毫秒级时间戳（13位数字）
  const timestamp = Date.now().toString()

  // 2. 生成随机数（5位，确保整体长度不超过18位）
  // 5位随机数范围：0-99999，通过补0确保固定长度
  const randomNum = Math.floor(Math.random() * 100000)
    .toString()
    .padStart(5, '0')

  // 3. 拼接结果（13+5=18位，刚好在Long类型范围内）
  const uuid = timestamp + randomNum

  // 4. 安全校验：确保不超过Long最大值（9223372036854775807）
  const maxLong = '9223372036854775807'
  if (uuid.length > maxLong.length || (uuid.length === maxLong.length && uuid > maxLong)) {
    // 极端情况：时间戳超过范围时，截取前18位并确保小于最大值
    return maxLong
  }

  return uuid
}
