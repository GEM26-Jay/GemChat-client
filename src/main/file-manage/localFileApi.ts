import { app } from 'electron'
import * as path from 'path'
import fsPromises from 'fs/promises'
import { constants } from 'fs'
import { UniversalFile } from '@shared/types'
import { getMIMEFromFilename, MIME } from '@shared/utils'

export class LocalFileManager {
  // 存储目录路径
  public readonly avatarDir: string
  public userFileDir: string | null = null

  // 单例实例
  private static instance: LocalFileManager

  // 私有构造函数，确保单例
  private constructor() {
    // 初始化头像共享目录
    this.avatarDir = path.join(app.getPath('userData'), 'Local Storage', 'FileStorage', 'avatars')
  }

  // 获取单例实例
  public static getInstance(): LocalFileManager {
    if (!LocalFileManager.instance) {
      LocalFileManager.instance = new LocalFileManager()
    }
    return LocalFileManager.instance
  }

  /**
   * 初始化存储目录
   * 确保头像目录和用户文件目录存在
   */
  public async initialize(userId: string): Promise<void> {
    // 初始化头像目录
    await this.ensureDirectoryExists(this.avatarDir)
    console.log(`[LocalFileManager]: 头像存储目录已准备就绪: ${this.avatarDir}`)

    // 初始化用户文件目录
    this.userFileDir = path.join(
      app.getPath('userData'),
      'Local Storage',
      'FileStorage',
      `${userId}`
    )
    await this.ensureDirectoryExists(this.userFileDir)
    console.log(`[LocalFileManager]: 用户文件目录已准备就绪: ${this.userFileDir}`)
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
        console.log(`[LocalFileManager]: 目录已创建: ${dirPath}`)
      } else {
        console.error(`[LocalFileManager]: 目录访问失败: ${(error as Error).message}`)
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
   * 验证用户文件目录是否已初始化
   */
  private validateUserDir(): void {
    if (!this.userFileDir) {
      throw new Error('用户文件目录未初始化，请先调用initialize方法')
    }
  }

  /**
   * 保存用户文件到本地
   * 针对大文件（contentType为null）通过本地路径直接复制，避免内存占用
   */
  public async writeUserFile(file: UniversalFile): Promise<UniversalFile> {
    this.validateUserDir()

    // 参数校验
    if (!file.fileName) {
      throw new Error('文件名不能为空')
    }
    if (!file.mimeType) {
      throw new Error('文件MIME类型不能为空')
    }

    // 路径处理
    const destFilePath = path.join(this.userFileDir as string, file.fileName)
    const destDir = path.dirname(destFilePath)

    // 确保目标目录存在
    await this.ensureDirectoryExists(destDir)

    try {
      // 处理不同contentType的情况
      if (file.contentType === null) {
        // 大文件处理：通过localPath复制
        if (!file.localPath) {
          throw new Error('contentType为null时，localPath必须存在（大文件本地路径）')
        }

        // 检查源文件是否存在且可读
        try {
          await fsPromises.access(file.localPath, constants.F_OK | constants.R_OK)
        } catch {
          throw new Error(`源文件不存在或不可读: ${file.localPath}`)
        }

        // 复制文件（支持大文件，不会加载到内存）
        await fsPromises.copyFile(file.localPath, destFilePath)
        console.log(`[LocalFileManager]: 大文件复制完成: ${file.localPath} -> ${destFilePath}`)
      } else {
        // 小文件处理：内存内容写入
        if (file.content === undefined) {
          throw new Error(`contentType为${file.contentType}时，content必须存在`)
        }

        let writeContent: string | Buffer
        switch (file.contentType) {
          case 'Text':
            if (typeof file.content !== 'string') {
              throw new Error('contentType为Text时，content必须是string')
            }
            writeContent = file.content
            break

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

        // 写入文件内容
        await fsPromises.writeFile(destFilePath, writeContent)
      }

      // 获取文件信息
      const fileStats = await fsPromises.stat(destFilePath)

      // 返回更新后的文件对象
      return {
        ...file,
        fileSize: fileStats.size,
        localPath: destFilePath, // 更新为新的保存路径
        contentType: file.contentType
      }
    } catch (err) {
      console.error(`[LocalFileManager]: 保存用户文件失败: ${(err as Error).message}`)
      throw new Error(`保存文件失败: ${(err as Error).message}`)
    }
  }

  /**
   * 读取用户文件
   */
  public async readUserFile(
    fileName: string,
    contentType: null | 'Base64' | 'Text' | 'ArrayBuffer'
  ): Promise<UniversalFile> {
    this.validateUserDir()
    const filePath = path.join(this.userFileDir as string, fileName)

    // 检查文件是否存在
    try {
      await fsPromises.access(filePath, constants.F_OK)
    } catch {
      throw new Error(`文件不存在: ${filePath}`)
    }

    // 获取文件基本信息
    const stats = await fsPromises.stat(filePath)
    const mimeType: MIME = getMIMEFromFilename(fileName) || 'application/octet-stream'

    // 不读取内容的情况
    if (contentType === null) {
      return {
        fileName,
        mimeType,
        fileSize: stats.size,
        content: undefined,
        contentType: null,
        localPath: filePath
      }
    }

    // 读取文件内容
    const buffer = await fsPromises.readFile(filePath)
    let content: string | ArrayBuffer

    // 根据目标contentType处理内容
    switch (contentType) {
      case 'Text':
        content = buffer.toString('utf8')
        break
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
      localPath: filePath
    }
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
      console.error(`[LocalFileManager]: 保存头像文件失败: ${(err as Error).message}`)
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
   * 检查用户文件是否存在
   */
  public async userFileExists(fileName: string): Promise<boolean> {
    this.validateUserDir()
    const filePath = path.join(this.userFileDir as string, fileName)
    try {
      await fsPromises.access(filePath, constants.F_OK)
      return true
    } catch {
      return false
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
   * 获取用户文件目录
   */
  public getUserFileDir(): string {
    return this.userFileDir as string
  }

  /**
   * 获取头像目录
   */
  public getAvatarDir(): string {
    return this.avatarDir
  }

  /**
   * 切换用户时更新用户文件目录
   */
  public async switchUser(userId: string): Promise<void> {
    this.userFileDir = path.join(
      app.getPath('userData'),
      'Local Storage',
      'FileStorage',
      `${userId}`
    )
    await this.ensureDirectoryExists(this.userFileDir)
    console.log(`[LocalFileManager]: 已切换到用户目录: ${this.userFileDir}`)
  }
}

// 导出单例实例
export const localFileManager = LocalFileManager.getInstance()
