import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import path from 'path'
import { ApiResult, MimeContentTypeMap, UniversalFile } from '@shared/types'
import localFileManager from './localFileApi'
import localAvatarManager from './localAvatarApi'
import { compressImage, openFileDialog, openImageWithSystemViewer } from './fileUtils'
import {
  getOssAvatarDownloadToken,
  getOssFileDownloadToken,
  postOssFileUploadToken,
  postOssAvatarUploadToken,
  putOssFileSuccessUpload
} from '@main/axios/axiosOssApi'
import { ossDownload, ossUpload } from './aliyunOssApi'
import fs from 'fs'
import fsPromises from 'fs/promises'

/**
 * 保存文件到本地用户目录
 */
export const saveFileToLocal = async (file: UniversalFile): Promise<ApiResult<UniversalFile>> => {
  try {
    // 1. 校验入参
    if (!file?.fileName) throw new Error('[saveFileToLocal] 文件名不能为空')
    if (!file.localPath) throw new Error('[saveFileToLocal] 文件本地路径不能为空')
    try {
      await fs.promises.access(file.localPath, fs.constants.F_OK)
    } catch {
      throw new Error(`[saveFileToLocal] 本地文件不存在: ${file.localPath}`)
    }

    // 3. 保存到本地文件空间
    const userFileDir = localFileManager.getUserFileDir()
    if (!userFileDir) {
      return { isSuccess: false, msg: '[saveFileToLocal] 用户文件目录未初始化' }
    }
    const newFileName = file.fingerprint + file.fileName.slice(file.fileName.lastIndexOf('.'))
    const updatedFile = { ...file, fileName: newFileName }
    const localFile = await localFileManager.writeUserFile(updatedFile)
    return {
      isSuccess: true,
      data: localFile
    }
  } catch (error) {
    return {
      isSuccess: false,
      msg: error as string
    }
  }
}

/**
 * 上传用户文件到 OSS 上
 */
export const sendFileToOss = async (
  fileName: string,
  fromType: number,
  onProgress: (value: number) => unknown = () => {},
  onError: () => unknown = () => {},
  fromSession?: string,
  fromInfo?: string
): Promise<ApiResult<void>> => {
  try {
    // 校验入参
    if (!fileName) throw new Error('[sendFileToOss] 文件名不能为空')

    const file = await localFileManager.readUserFile(fileName, null)
    if (!file) throw new Error('[sendFileToOss] 用户空间不存在该文件')

    // 2. 获取上传令牌
    const tokenApi = await postOssFileUploadToken({
      name: file.fileName,
      size: file.fileSize,
      mimeType: file.mimeType,
      fingerprint: file.fingerprint as string,
      fromType,
      fromSession,
      fromInfo: fromInfo
    })

    if (!tokenApi.isSuccess || !tokenApi.data) throw new Error('token获取失败')

    const token = tokenApi.data
    if (!token.exist) {
      // 异步上传开始，提交上传任务
      const selfOnProgress = async (value): Promise<void> => {
        if (value >= 100) {
          const apiRe = await putOssFileSuccessUpload(token.name)
          if (apiRe.isSuccess) {
            onProgress(value)
          } else {
            onError()
          }
        }
      }
      ossUpload(tokenApi.data, file.localPath as string, selfOnProgress, onError)
    } else {
      // OSS 文件存在，模拟上传进度
      setTimeout(() => onProgress(0), 500)
      setTimeout(() => onProgress(20), 1000)
      setTimeout(() => onProgress(40), 1500)
      setTimeout(() => onProgress(60), 2000)
      setTimeout(() => onProgress(80), 2500)
      setTimeout(() => onProgress(100), 3000)
    }
    return {
      isSuccess: true
    }
  } catch (error) {
    return {
      isSuccess: false,
      msg: error as string
    }
  }
}

/**
 * 下载 OSS 文件到用户目录
 */
export const downloadFileFromOss = async (
  fileName: string,
  onProgress: (value: number) => unknown,
  onError: () => unknown
): Promise<ApiResult<void>> => {
  try {
    // 1. 检查本地文件是否存在
    if (!fileName) throw new Error('文件名无效')

    const localExists = await localFileManager.userFileExists(fileName)

    if (!localExists) {
      const tokenApi = await getOssFileDownloadToken(fileName)
      if (!tokenApi.isSuccess || !tokenApi.data) throw new Error('Token获取失败')
      ossDownload(tokenApi.data, localFileManager.getUserFileDir(), onProgress, onError)
    } else {
      // 本地存在文件，模拟下载进度
      setTimeout(() => onProgress(0), 500)
      setTimeout(() => onProgress(20), 1000)
      setTimeout(() => onProgress(40), 1500)
      setTimeout(() => onProgress(60), 2000)
      setTimeout(() => onProgress(80), 2500)
      setTimeout(() => onProgress(100), 3000)
    }
    return {
      isSuccess: true
    }
  } catch (error) {
    return {
      isSuccess: false,
      msg: error as string
    }
  }
}

/**
 * 将用户文件另存
 */
export const otherSaveFile = async (
  fileName: string,
  targetPath: string
): Promise<ApiResult<boolean>> => {
  try {
    // 1. 校验入参
    if (!fileName) throw new Error('[otherSaveFile] 文件名不能为空')
    if (!targetPath) throw new Error('[otherSaveFile] 目标路径不能为空')

    if (!(await localFileManager.userFileExists(fileName))) throw new Error('文件不存在')
    const sourcePath = path.join(await localFileManager.getUserFileDir(), fileName)
    fsPromises.copyFile(sourcePath, targetPath)
    return {
      isSuccess: true
    }
  } catch (error) {
    return {
      isSuccess: false,
      msg: error as string
    }
  }
}

/**
 * 获取用户文件（从本地获取）
 */
export const getUserFileFromLocal = async (
  fileName: string,
  contentType: null | 'ArrayBuffer' | 'Base64' | 'Text'
): Promise<ApiResult<UniversalFile>> => {
  // 1. 检查本地文件是否存在
  if (!fileName) {
    return { isSuccess: false, msg: '[getUserFile] 文件名无效' }
  }
  const localExists = await localFileManager.userFileExists(fileName)

  if (localExists) {
    const localFile = await localFileManager.readUserFile(fileName, contentType)
    return {
      isSuccess: true,
      data: localFile
    }
  } else {
    return {
      isSuccess: false,
      msg: '本地文件读取失败'
    }
  }
}

/**
 * 获取头像文件
 */
export const getAvatar = async (
  fileName: string,
  contentType: null | 'ArrayBuffer' | 'Base64' = 'Base64'
): Promise<ApiResult<UniversalFile>> => {
  try {
    // 1. 检查本地头像是否存在
    if (!fileName) {
      return { isSuccess: false, msg: '[getAvatar] 头像文件名不能为空' }
    }
    const localExists = await localAvatarManager.avatarExists(fileName)
    if (localExists) {
      const localAvatar = await localAvatarManager.readAvatar(fileName, contentType)
      return { isSuccess: true, data: localAvatar }
    }

    // 2. 本地不存在，同步从OSS下载
    const tokenApi = await getOssAvatarDownloadToken(fileName)
    if (!tokenApi.isSuccess || !tokenApi.data) {
      return {
        isSuccess: false,
        msg: '[getAvatar] OSS 令牌获取失败：' + (tokenApi.msg || '未知错误')
      }
    }

    // 头像小文件：空回调（不触发进度）
    const onProgress = (): void => {}
    const onError = (): void => {}

    const avatarDir = localAvatarManager.getAvatarDir()
    const ossResult = await ossDownload(tokenApi.data, avatarDir, onProgress, onError)

    if (!ossResult.isSuccess) {
      return {
        isSuccess: false,
        msg: '[getAvatar] OSS 头像下载失败：' + (ossResult.msg || '未知错误')
      }
    }

    // 3. 下载成功后返回
    const cachedAvatar = await localAvatarManager.readAvatar(fileName, contentType)
    return { isSuccess: true, data: cachedAvatar }
  } catch (error) {
    const msg = `获取头像失败: ${error instanceof Error ? error.message : String(error)}`
    return { isSuccess: false, msg }
  }
}

/**
 * 上传头像文件(头像文件需要content)
 */
export const uploadAvatar = async (file: UniversalFile): Promise<ApiResult<UniversalFile>> => {
  try {
    // 1. 头像入参校验
    if (!file?.fileName) throw new Error('[uploadAvatar] 头像文件名不能为空')
    if (!file.content) throw new Error('[uploadAvatar] 头像内容不能为空')
    if (file.mimeType && !file.mimeType.startsWith('image/')) {
      throw new Error(`[uploadAvatar] 不支持的文件类型: ${file.mimeType}`)
    }

    // 2. 压缩图片
    const compressedAvatar = await compressImage(file)
    if (!compressedAvatar) {
      throw new Error('[uploadAvatar] 图片压缩失败')
    }

    // 3. 获取上传令牌
    const tokenApi = await postOssAvatarUploadToken({
      name: compressedAvatar.fileName,
      size: compressedAvatar.fileSize,
      mimeType: compressedAvatar.mimeType,
      fingerprint: compressedAvatar.fingerprint as string
    })
    if (!tokenApi.isSuccess || !tokenApi.data) {
      return {
        isSuccess: false,
        msg: '[uploadAvatar] 头像上传令牌获取失败: ' + (tokenApi.msg || '未知错误')
      }
    }

    const token = tokenApi.data
    const newFileName = token.name

    // 4. 保存到本地头像目录
    const avatarDir = localAvatarManager.getAvatarDir()
    if (!avatarDir) {
      return { isSuccess: false, msg: '[uploadAvatar] 头像目录未初始化' }
    }
    const localAvatar = await localAvatarManager.writeAvatar({
      ...compressedAvatar,
      fileName: newFileName
    })

    // 5. 处理OSS已存在的情况
    if (token.exist) {
      return { isSuccess: true, data: localAvatar }
    }

    // 6. 同步上传到OSS（无进度，失败不清理本地文件）
    const localPath = path.join(avatarDir, newFileName)
    // 空回调（不触发进度）
    const onProgress = (): void => {}
    const onError = (): void => {}

    const ossResult = await ossUpload(token, localPath, onProgress, onError)
    if (!ossResult.isSuccess) {
      return {
        isSuccess: false,
        msg: '[uploadAvatar] OSS上传失败: ' + (ossResult.msg || '未知错误')
      }
    }

    return {
      isSuccess: true,
      data: await localAvatarManager.readAvatar(newFileName, null)
    }
  } catch (error) {
    const msg = `上传头像失败: ${error instanceof Error ? error.message : String(error)}`
    return { isSuccess: false, msg }
  }
}

const formatDate = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0') // 月份从0开始
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${year}-${month}-${day}-${hours}-${minutes}-${seconds}`
}

/**
 * 注册文件管理相关的 IPC 通信句柄（主进程 <-> 渲染进程）
 */
export function registerFileManageIpcHandlers(): void {
  // 获取用户文件
  ipcMain.handle(
    'getUserFile',
    async (
      _event,
      fileName: string,
      contentType: null | 'ArrayBuffer' | 'Base64' | 'Text'
    ): Promise<ApiResult<UniversalFile>> => {
      return getUserFileFromLocal(fileName, contentType)
    }
  )

  // 获取头像文件
  ipcMain.handle(
    'getAvatar',
    async (
      _event,
      fileName: string,
      contentType: null | 'ArrayBuffer' | 'Base64' = 'Base64'
    ): Promise<ApiResult<UniversalFile>> => {
      return getAvatar(fileName, contentType)
    }
  )

  // 上传用户文件
  ipcMain.handle(
    'uploadUserFile',
    async (
      _event,
      file: UniversalFile,
      fromType: number,
      fromSession?: string
    ): Promise<ApiResult<void>> => {
      // todo: 暂未实现
      return {
        isSuccess: false
      }
    }
  )

  // 上传头像文件
  ipcMain.handle(
    'uploadAvatar',
    async (_event, file: UniversalFile): Promise<ApiResult<UniversalFile>> => {
      return uploadAvatar(file)
    }
  )

  // 打开文件选择器
  ipcMain.handle(
    'openFileDialog',
    async (_event, map: MimeContentTypeMap): Promise<ApiResult<UniversalFile[]>> => {
      return openFileDialog(map)
    }
  )

  // 打开图片查看器
  ipcMain.handle('openImageViewer', async (_event, fileName: string): Promise<void> => {
    const relPath = localFileManager.getUserFileDir()
    openImageWithSystemViewer(path.join(relPath, fileName))
  })

  // otherSaveFile
  ipcMain.handle('otherSaveFile', async (_event, fileName: string): Promise<boolean> => {
    try {
      // 1. 获取源文件路径（你的原始图片路径）
      const relPath = localFileManager.getUserFileDir()
      const sourcePath = path.join(relPath, fileName) // 源路径
      const extName = path.extname(fileName)

      const newFileName = formatDate(new Date()) + extName
      // 2. 检查源文件是否存在
      if (!fs.existsSync(sourcePath)) {
        console.error(`源文件不存在：${sourcePath}`)
        return false
      }

      // 3. 打开文件选择器，让用户选择目标路径
      const mainWindow = BrowserWindow.getFocusedWindow()
      if (!mainWindow) return false

      const result = await dialog.showSaveDialog(mainWindow, {
        title: '另存为',
        defaultPath: path.join(app.getPath('downloads'), newFileName) // 默认下载目录+文件名
      })

      if (result.canceled) return false
      const targetPath = result.filePath // 用户选择的目标路径

      // 4. 直接拷贝文件（异步方式，避免阻塞）
      await fsPromises.copyFile(sourcePath, targetPath)
      console.log(`文件拷贝成功：${sourcePath} -> ${targetPath}`)
      return true
    } catch (error) {
      console.error('文件拷贝失败：', error)
      return false
    }
  })

  // openVideoPlayer
  ipcMain.handle('openVideoPlayer', async (_event, fileName: string): Promise<boolean> => {
    try {
      // 1. 获取视频文件的完整路径
      const relPath = localFileManager.getUserFileDir()
      const filePath = path.join(relPath, fileName)

      // 2. 检查文件是否存在（避免打开失败）
      if (!fs.existsSync(filePath)) {
        console.error(`文件不存在：${filePath}`)
        return false
      }

      // 3. 调用系统默认程序打开视频（自动关联媒体播放器）
      // shell.openPath() 会返回操作结果（Windows 可能返回空字符串表示成功）
      const result = await shell.openPath(filePath)

      // 判断是否成功（不同系统返回值略有差异）
      const isSuccess = result === '' // Windows 成功返回空字符串
      // macOS/Linux 成功返回 undefined 或空字符串，可统一判断
      if (isSuccess) {
        console.log(`已用系统播放器打开：${filePath}`)
        return true
      } else {
        console.error(`打开失败：${result}`)
        return false
      }
    } catch (error) {
      console.error('打开视频播放器出错：', error)
      return false
    }
  })
}
