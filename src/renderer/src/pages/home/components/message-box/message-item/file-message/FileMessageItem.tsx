import {
  ChatMessage,
  FileErrorEvent,
  FileMap,
  FileMapStatus,
  FileProgressEvent,
  MessageType
} from '@shared/types'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import ImageMessageItem from './sub/ImageMessageItem'
import VideoMessageItem from './sub/VideoMessageItem'
import OtherFileMessageItem from './sub/OtherFileMessageItem'

// 提取文件操作相关类型
export interface FileOperationState {
  operation: null | 'upload' | 'download'
  progress: number
  errorInfo: string
}

interface FileMessageItemProps {
  message: ChatMessage
  inOps: boolean
  isMine: boolean
}

// 抽象父组件 - 封装通用文件逻辑
const FileMessageItem: React.FC<FileMessageItemProps> = ({ message, inOps, isMine }) => {
  const [localExist, setLocalExist] = useState(false)
  const [fileState, setFileState] = useState<FileOperationState>({
    operation: null,
    progress: 0,
    errorInfo: ''
  })

  const [inOpss, setInOpss] = useState(inOps)

  const fingerprint = message.content.split(':')[1]
  // 获取文件映射信息
  const { data: fileMap, refetch } = useQuery<FileMap | null>({
    queryKey: ['fileMap', message.sessionId, fingerprint],
    queryFn: () => {
      return window.businessApi.file
        .getInfoBySessionIdAndFingerprint(message.sessionId, fingerprint)
        .then((res) => (res.isSuccess && res.data ? res.data : null))
        .catch(() => null)
    },
    enabled: !!message.sessionId && !!fingerprint
  })

  // 初始化文件状态
  useEffect(() => {
    if (!fileMap) return

    if (fileMap) {
      const isSynced =
        fileMap.status === FileMapStatus.SYNCED ||
        fileMap.status === FileMapStatus.WAIT_UPLOAD ||
        fileMap.status === FileMapStatus.UPLOADING
      setLocalExist(isSynced)
      setFileState((prev) => ({ ...prev, progress: isSynced ? 100 : 0 }))
    }
  }, [fileMap])

  // 监听文件进度和错误
  useEffect(() => {
    if (!fileMap) return
    if (inOpss) {
      const handleProgress = (event: FileProgressEvent): void => {
        if (event.taskId === fileMap.fingerprint) {
          if (event.progress >= 100) {
            refetch()
          }
          setFileState({
            operation: event.type as 'upload' | 'download',
            progress: event.progress as number,
            errorInfo: ''
          })
        }
      }

      const handleError = (event: FileErrorEvent): void => {
        if (event.taskId === fileMap.fingerprint) {
          setFileState({
            operation: event.type as 'upload' | 'download',
            progress: -1,
            errorInfo: '文件' + event.type == 'upload' ? '上传' : '下载' + '失败'
          })
        }
      }
      window.fileManager.onFileProgress(handleProgress)
      window.fileManager.onFileError(handleError)
    }
  }, [refetch, fileMap, inOpss])

  // 通用文件操作方法
  const handleFileAction = (action: 'download' | 'retry'): void => {
    if (!fileMap) return
    setInOpss(true)
    if (action === 'download' || action === 'retry') {
      setFileState((prev) => ({ ...prev, operation: 'download', errorInfo: '' }))
      window.businessApi.chat.downloadChatFile(fileMap.remoteName)
    }
  }

  // 打开文件预览
  const handleOpenFile = (): void => {
    if (!localExist || !fileMap) return

    switch (message.type) {
      case MessageType.IMAGE:
        window.fileManager.openImageViewer(fileMap.remoteName)
        break
      case MessageType.VIDEO:
        window.fileManager.openVideoPlayer(fileMap.remoteName)
        break
      default:
        window.fileManager.otherSaveFile(fileMap.remoteName)
    }
  }

  // 根据消息类型渲染对应的子组件
  const renderFileItem = (): React.ReactNode => {
    if (!fileMap) return
    switch (message.type) {
      case MessageType.IMAGE:
        return (
          <ImageMessageItem
            fileMap={fileMap}
            message={message}
            fileState={fileState}
            localExist={localExist}
            isMine={isMine}
            onFileAction={handleFileAction}
            onOpenFile={handleOpenFile}
          />
        )
      case MessageType.VIDEO:
        return (
          <VideoMessageItem
            fileMap={fileMap}
            message={message}
            localExist={localExist}
            fileState={fileState}
            isMine={isMine}
            onFileAction={handleFileAction}
            onOpenFile={handleOpenFile}
          />
        )
      default:
        return (
          <OtherFileMessageItem
            fileMap={fileMap}
            message={message}
            localExist={localExist}
            fileState={fileState}
            isMine={isMine}
            onFileAction={handleFileAction}
            onOpenFile={handleOpenFile}
          />
        )
    }
  }

  return renderFileItem()
}

export default FileMessageItem
