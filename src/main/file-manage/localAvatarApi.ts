import { app } from 'electron'
import * as path from 'path'
import fsPromises from 'fs/promises'
import { constants } from 'fs'
import { UniversalFile } from '@shared/types'
import { MIME } from '@shared/utils'

export class LocalAvatarManager {
  // 头像存储目录路径
  public readonly avatarDir: string

  // 单例实例
  private static instance: LocalAvatarManager

  // 私有构造函数，确保单例
  private constructor() {
    // 初始化头像共享目录
    this.avatarDir = path.join(app.getPath('userData'), 'Local Storage', 'FileStorage', 'avatars')
  }

  // 获取单例实例
  public static getInstance(): LocalAvatarManager {
    if (!LocalAvatarManager.instance) {
      LocalAvatarManager.instance = new LocalAvatarManager()
    }
    return LocalAvatarManager.instance
  }

  /**
   * 初始化头像目录
   */
  public async initialize(): Promise<void> {
    await this.ensureDirectoryExists(this.avatarDir)
    console.log(`[LocalAvatarManager]: 头像存储目录已准备就绪: ${this.avatarDir}`)
  }

  /**
   * 确保目录存在，不存在则创建
   */
  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fsPromises.access(dirPath, constants.F_OK | constants.W_OK | constants.R_OK)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        await fsPromises.mkdir(dirPath, { recursive: true })
        console.log(`[LocalAvatarManager]: 目录已创建: ${dirPath}`)
      } else {
        console.error(`[LocalAvatarManager]: 目录访问失败: ${(error as Error).message}`)
        throw error
      }
    }
  }

  /**
   * Buffer 转 ArrayBuffer
   */
  private bufferToArrayBuffer(buffer: Buffer): ArrayBuffer {
    return buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength
    ) as ArrayBuffer
  }

  /**
   * ArrayBuffer 转 Buffer
   */
  private arrayBufferToBuffer(arrayBuffer: ArrayBuffer): Buffer {
    return Buffer.from(arrayBuffer)
  }

  /**
   * 保存头像文件
   */
  public async writeAvatar(file: UniversalFile): Promise<UniversalFile> {
    // 参数校验
    if (!file.fileName) {
      throw new Error('文件名不能为空')
    }
    if (file.content === undefined && file.contentType !== null) {
      throw new Error('文件内容不能为空（contentType非null时）')
    }
    if (!file.mimeType) {
      throw new Error('文件MIME类型不能为空')
    }

    // 路径处理
    const destFilePath = path.join(this.avatarDir, file.fileName)
    const destDir = path.dirname(destFilePath)

    // 确保目录存在
    await this.ensureDirectoryExists(destDir)

    try {
      let writeContent: Buffer

      // 根据contentType处理内容
      switch (file.contentType) {
        case 'Base64':
          if (typeof file.content !== 'string') {
            throw new Error('contentType为Base64时，content必须是string')
          }
          writeContent = Buffer.from(file.content, 'base64')
          break

        case 'ArrayBuffer':
          if (!(file.content instanceof ArrayBuffer)) {
            throw new Error('contentType为ArrayBuffer时，content必须是ArrayBuffer')
          }
          writeContent = this.arrayBufferToBuffer(file.content)
          break

        default:
          throw new Error(`未处理的contentType: ${file.contentType}`)
      }

      // 写入文件
      await fsPromises.writeFile(destFilePath, writeContent)

      // 获取文件信息
      const fileStats = await fsPromises.stat(destFilePath)

      // 返回更新后的文件对象
      return {
        ...file,
        fileSize: fileStats.size,
        localPath: destFilePath,
        contentType: file.contentType
      }
    } catch (err) {
      console.error(`[LocalAvatarManager]: 保存头像文件失败: ${(err as Error).message}`)
      throw new Error(`保存头像失败: ${(err as Error).message}`)
    }
  }

  /**
   * 读取头像文件
   */
  public async readAvatar(
    fileName: string,
    contentType: null | 'Base64' | 'ArrayBuffer'
  ): Promise<UniversalFile> {
    const avatarPath = path.join(this.avatarDir, fileName)

    // 检查文件是否存在
    try {
      await fsPromises.access(avatarPath, constants.F_OK)
    } catch {
      throw new Error(`头像文件不存在: ${avatarPath}`)
    }

    // 获取文件基本信息
    const stats = await fsPromises.stat(avatarPath)
    const mimeType: MIME = 'image/jpeg' as MIME

    // 不读取内容的情况
    if (contentType === null) {
      return {
        fileName,
        mimeType,
        fileSize: stats.size,
        content: undefined,
        contentType: null,
        localPath: avatarPath
      }
    }

    // 读取文件内容
    const buffer = await fsPromises.readFile(avatarPath)
    let content: string | ArrayBuffer

    switch (contentType) {
      case 'Base64':
        content = buffer.toString('base64')
        break
      case 'ArrayBuffer':
        content = this.bufferToArrayBuffer(buffer)
        break
      default:
        throw new Error(`不支持的contentType: ${contentType}`)
    }

    return {
      fileName,
      mimeType,
      fileSize: stats.size,
      content,
      contentType,
      localPath: avatarPath
    }
  }

  /**
   * 检查头像文件是否存在
   */
  public async avatarExists(fileName: string): Promise<boolean> {
    const avatarPath = path.join(this.avatarDir, fileName)
    try {
      await fsPromises.access(avatarPath, constants.F_OK)
      return true
    } catch {
      return false
    }
  }

  /**
   * 获取头像目录
   */
  public getAvatarDir(): string {
    return this.avatarDir
  }
}

// 导出单例实例
const localAvatarManager = LocalAvatarManager.getInstance()
localAvatarManager.initialize()
export default localAvatarManager
