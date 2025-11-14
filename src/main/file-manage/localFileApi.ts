import { app } from 'electron'
import * as path from 'path'
import fsPromises from 'fs/promises'
import { constants } from 'fs'
import { UniversalFile } from '@shared/types'
import { getMIMEFromFilename, MIME } from '@shared/utils'
import { calculateFileFingerprintWithoutLoad } from './fileUtils'

export class LocalFileManager {
  // 用户文件目录
  private userFileDir: string | null = null

  // 单例实例
  private static instance: LocalFileManager

  private constructor() {
    // 私有构造函数，确保单例
  }

  // 获取单例实例
  public static getInstance(): LocalFileManager {
    if (!LocalFileManager.instance) {
      LocalFileManager.instance = new LocalFileManager()
    }
    return LocalFileManager.instance
  }

  /**
   * 初始化用户文件目录
   */
  public async initialize(userId: string): Promise<void> {
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
    const fingerprint = await calculateFileFingerprintWithoutLoad(filePath)

    const re = {
      fileName,
      mimeType,
      fileSize: stats.size,
      content: null,
      contentType: contentType,
      localPath: filePath,
      fingerprint: fingerprint
    } as UniversalFile

    if (contentType != null) {
      // 读取文件内容
      const buffer = await fsPromises.readFile(filePath)

      // 根据目标contentType处理内容
      switch (contentType) {
        case 'Text':
          re.content = buffer.toString('utf8')
          break
        case 'Base64':
          re.content = buffer.toString('base64')
          break
        case 'ArrayBuffer':
          re.content = this.bufferToArrayBuffer(buffer)
          break
        default:
          throw new Error(`不支持的contentType: ${contentType}`)
      }
    }

    return re
  }

  /**
   * 删除本地用户文件
   * @param fileName 要删除的文件名（含扩展名）
   * @returns Promise<void>
   */
  public async removeUserFile(fileName: string): Promise<void> {
    // 1. 验证目录是否初始化
    this.validateUserDir()

    // 2. 构建文件完整路径
    const filePath = path.join(this.userFileDir as string, fileName)

    // 3. 检查文件是否存在
    try {
      await this.userFileExists(fileName)
    } catch {
      throw new Error(`[LocalFileManager] 文件不存在：${fileName}`)
    }

    // 4. 检查是否为文件（避免删除目录）
    const stats = await fsPromises.stat(filePath)
    if (!stats.isFile()) {
      throw new Error(`[LocalFileManager] 路径不是文件：${filePath}`)
    }

    // 5. 执行删除操作
    try {
      await fsPromises.unlink(filePath)
      console.log(`[LocalFileManager] 文件已删除：${filePath}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(`[LocalFileManager] 删除文件失败：${message}`)
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
   * 获取用户文件目录
   */
  public getUserFileDir(): string {
    return this.userFileDir as string
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
const localFileManager = LocalFileManager.getInstance()
export default localFileManager
