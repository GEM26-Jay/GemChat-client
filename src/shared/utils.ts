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
 * @param filename 文件名（如 'image.jpg'、'data.json'、'document.PDF'）
 * @returns 对应的 MIME 类型，默认返回 'application/octet-stream'
 */
export function getMIMEFromFilename(filename: string): MIME {
  if (!filename) return 'application/octet-stream'

  // 提取扩展名（忽略大小写，如 'image.JPG' → 'jpg'）
  const lastDotIndex = filename.lastIndexOf('.')
  if (lastDotIndex === -1) return 'application/octet-stream' // 无扩展名

  const extension = filename.slice(lastDotIndex + 1).toLowerCase()

  // 查找映射表，未找到则返回默认类型
  return extensionToMIME[extension] || 'application/octet-stream'
}

// 工具函数：格式化文件大小（B → KB/MB/GB）
export const formatFileSize = (size: number): string => {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

// File转Base64工具
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.readAsDataURL(file)
  })
}

// 将File对象转换为Buffer
export const fileToBuffer = async (file: File): Promise<ArrayBuffer> => {
  const arrayBuffer = await file.arrayBuffer()
  return arrayBuffer
}

/**
 * 统一的文件指纹计算函数
 * 支持File对象、Base64字符串和ArrayBuffer输入，返回SHA-256哈希指纹
 */
export const calculateFileFingerprint = async (
  input: File | string | ArrayBuffer
): Promise<string> => {
  try {
    let arrayBuffer: ArrayBuffer

    if (input instanceof File) {
      // 处理浏览器File对象：直接转为ArrayBuffer
      arrayBuffer = await input.arrayBuffer()
    } else if (typeof input === 'string') {
      // 处理Base64字符串：先解码为ArrayBuffer
      const base64WithoutPrefix = input.replace(/^data:[^;]+;base64,/, '')
      const binaryString = atob(base64WithoutPrefix)

      // 转换为Uint8Array再获取ArrayBuffer
      const uint8Array = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        uint8Array[i] = binaryString.charCodeAt(i)
      }
      arrayBuffer = uint8Array.buffer
    } else if (input instanceof ArrayBuffer) {
      // 直接使用ArrayBuffer
      arrayBuffer = input
    } else {
      throw new Error('不支持的输入类型，支持File对象、Base64字符串和ArrayBuffer')
    }

    // 计算SHA-256指纹
    return calculateSha256(arrayBuffer)
  } catch (error) {
    console.error('计算文件指纹失败:', error)
    throw new Error('无法计算文件指纹，请重试')
  }
}

/**
 * 使用Web Crypto API计算ArrayBuffer的SHA-256哈希
 * 浏览器原生支持，无需额外依赖
 */
async function calculateSha256(arrayBuffer: ArrayBuffer): Promise<string> {
  // 使用浏览器内置的Web Crypto API计算哈希
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer)

  // 将哈希结果转换为十六进制字符串
  const uint8Array = new Uint8Array(hashBuffer)
  return Array.from(uint8Array)
    .map((byte) => byte.toString(16).padStart(2, '0')) // 确保每个字节为2位十六进制
    .join('')
}

// 工具函数：格式化时间戳为日期
export const formatDate = (timestamp: number): string => {
  return new Date(timestamp).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}
