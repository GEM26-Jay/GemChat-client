import { app } from 'electron'
import * as path from 'path'
import fsPromises from 'fs/promises'
import { clientDataStore } from '../clientDataStore'
import { constants } from 'fs'
import { access, mkdir } from 'fs/promises'
import { MIME, UniversalFile, User } from '@shared/types'
import { getMIMEFromFilename } from './fileManage'

// 头像共享目录
const avatarDir = path.join(app.getPath('userData'), 'Local Storage', 'FileStorage', 'avatars')

// 用户数据存储根目录
let userFileDir: string = ''

// 初始化存储目录：不存在则创建
export const initializeLocalStorage = async (): Promise<void> => {
  // 初始化头像目录
  try {
    await access(avatarDir, constants.F_OK | constants.W_OK | constants.R_OK)
    console.log(`[LocalFileManage]: 头像存储目录已存在: ${avatarDir}`)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      await mkdir(avatarDir, { recursive: true })
      console.log(`[LocalFileManage]: 头像存储目录已创建: ${avatarDir}`)
    } else {
      console.error(`[LocalFileManage]: 头像目录初始化失败: ${(error as Error).message}`)
      throw error
    }
  }
  const user = clientDataStore.get('user') as User
  if (user) {
    // 用户已经登录
    userFileDir = path.join(app.getPath('userData'), 'Local Storage', 'FileStorage', `${user.id}`)
    // 初始化用户文件目录
    try {
      await access(userFileDir, constants.F_OK | constants.W_OK | constants.R_OK)
      console.log(`[LocalFileManage]: 用户文件目录已存在: ${userFileDir}`)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        await mkdir(userFileDir, { recursive: true })
        console.log(`[LocalFileManage]: 用户文件目录已创建: ${userFileDir}`)
      } else {
        console.error(`[LocalFileManage]: 用户目录初始化失败: ${(error as Error).message}`)
        throw error
      }
    }
  }
}

/**
 * 保存用户文件到本地
 * 基于新的contentType类型处理（Base64/Text/Buffer）
 */
export const writeUserFileLocal = async (file: UniversalFile): Promise<UniversalFile> => {
  // 1. 参数校验
  if (!file.fileName) {
    throw new Error('文件名不能为空')
  }
  if (file.content === undefined && file.contentType !== null) {
    throw new Error('文件内容不能为空（contentType非null时）')
  }
  if (!file.mimeType) {
    throw new Error('文件MIME类型不能为空')
  }

  // 2. 路径处理
  const destFilePath = path.join(userFileDir, file.fileName)
  const destDir = path.dirname(destFilePath)

  // 3. 确保目录存在
  try {
    await fsPromises.access(destDir)
  } catch {
    await fsPromises.mkdir(destDir, { recursive: true })
  }

  try {
    let writeContent: string | Buffer

    // 4. 根据contentType处理内容
    switch (file.contentType) {
      case 'Text':
        if (typeof file.content !== 'string') {
          throw new Error('contentType为Text时，content必须是string')
        }
        writeContent = file.content // 直接写入文本
        break

      case 'Base64':
        if (typeof file.content !== 'string') {
          throw new Error('contentType为Base64时，content必须是string')
        }
        writeContent = Buffer.from(file.content, 'base64') // Base64转Buffer
        break

      case 'Buffer':
        if (!(file.content instanceof Buffer)) {
          throw new Error('contentType为Buffer时，content必须是Buffer')
        }
        writeContent = file.content // 直接写入Buffer
        break

      case null:
        // 仅创建空文件
        writeContent = Buffer.alloc(0)
        break

      default:
        throw new Error(`未处理的contentType: ${file.contentType}`)
    }

    // 5. 写入文件
    await fsPromises.writeFile(destFilePath, writeContent)

    // 6. 获取文件信息
    const fileStats = await fsPromises.stat(destFilePath)

    // 7. 返回更新后的文件对象
    return {
      ...file,
      fileSize: fileStats.size,
      localPath: destFilePath,
      contentType: file.contentType // 保持contentType一致性
    }
  } catch (err) {
    console.error(`[LocalFileManage]: 保存用户文件失败: ${(err as Error).message}`)
    throw new Error(`保存文件失败: ${(err as Error).message}`)
  }
}

/**
 * 读取用户文件
 * 根据新的contentType类型返回对应格式内容
 */
export const readUserFileLocal = async (
  fileName: string,
  contentType: null | 'Base64' | 'Text' | 'Buffer'
): Promise<UniversalFile> => {
  const filePath = path.join(userFileDir, fileName)

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
  let content: string | Buffer

  // 根据目标contentType处理内容
  switch (contentType) {
    case 'Text':
      content = buffer.toString('utf8')
      break
    case 'Base64':
      content = buffer.toString('base64')
      break
    case 'Buffer':
      content = buffer
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
 * 压缩并保存头像
 * 统一处理为JPEG格式，contentType设为Base64
 */
export const writeAvatarLocal = async (file: UniversalFile): Promise<UniversalFile> => {
  // 1. 参数校验
  if (!file.fileName) {
    throw new Error('文件名不能为空')
  }
  if (file.content === undefined && file.contentType !== null) {
    throw new Error('文件内容不能为空（contentType非null时）')
  }
  if (!file.mimeType) {
    throw new Error('文件MIME类型不能为空')
  }

  // 2. 路径处理
  const destFilePath = path.join(avatarDir, file.fileName)
  const destDir = path.dirname(destFilePath)

  // 3. 确保目录存在
  try {
    await fsPromises.access(destDir)
  } catch {
    await fsPromises.mkdir(destDir, { recursive: true })
  }

  try {
    let writeContent: string | Buffer

    // 4. 根据contentType处理内容
    switch (file.contentType) {
      case 'Base64':
        if (typeof file.content !== 'string') {
          throw new Error('contentType为Base64时，content必须是string')
        }
        writeContent = Buffer.from(file.content, 'base64') // Base64转Buffer
        break

      case 'Buffer':
        if (!(file.content instanceof Buffer)) {
          throw new Error('contentType为Buffer时，content必须是Buffer')
        }
        writeContent = file.content // 直接写入Buffer
        break

      default:
        throw new Error(`未处理的contentType: ${file.contentType}`)
    }

    // 5. 写入文件
    await fsPromises.writeFile(destFilePath, writeContent)

    // 6. 获取文件信息
    const fileStats = await fsPromises.stat(destFilePath)

    // 7. 返回更新后的文件对象
    return {
      ...file,
      fileSize: fileStats.size,
      localPath: destFilePath,
      contentType: file.contentType
    }
  } catch (err) {
    console.error(`[LocalFileManage]: 保存用户文件失败: ${(err as Error).message}`)
    throw new Error(`保存文件失败: ${(err as Error).message}`)
  }
}

/**
 * 读取头像文件
 * 支持返回Base64/Buffer类型
 */
export const readAvatarLocal = async (
  fileName: string,
  contentType: null | 'Base64' | 'Text' | 'Buffer'
): Promise<UniversalFile> => {
  const avatarPath = path.join(avatarDir, fileName)

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

  // 头像不支持Text类型
  if (contentType === 'Text') {
    throw new Error('头像文件不支持Text类型读取')
  }

  // 读取文件内容
  const buffer = await fsPromises.readFile(avatarPath)
  let content: string | Buffer

  switch (contentType) {
    case 'Base64':
      content = buffer.toString('base64')
      break
    case 'Buffer':
      content = buffer
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
export const userFileExists = async (fileName: string): Promise<boolean> => {
  const filePath = path.join(userFileDir, fileName)
  try {
    await access(filePath, constants.F_OK)
    return true
  } catch {
    return false
  }
}

/**
 * 检查头像文件是否存在
 */
export const avatarExists = async (fileName: string): Promise<boolean> => {
  const avatarPath = path.join(avatarDir, fileName)
  try {
    await access(avatarPath, constants.F_OK)
    return true
  } catch {
    return false
  }
}
