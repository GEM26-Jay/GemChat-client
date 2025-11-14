import styles from './OtherFileMessageItem.module.css'
import { formatFileSize } from '@shared/utils'
import {
  FaDownload,
  FaRotateRight,
  FaFile,
  FaFileAudio,
  FaFileExcel,
  FaFileImage,
  FaFilePdf,
  FaFileVideo,
  FaFileWord
} from 'react-icons/fa6'
import { FileOperationState } from '../FileMessageItem'
import { FileMap, ChatMessage } from '@shared/types'

interface OtherFileMessageItemProps {
  fileMap: FileMap
  message: ChatMessage
  localExist: boolean
  fileState: FileOperationState
  isMine: boolean
  onFileAction: (action: 'download' | 'retry') => void
  onOpenFile: () => void
}

const getIconByMIME = (mimeType: string): React.ReactNode => {
  if (mimeType.startsWith('image/')) {
    return <FaFileImage className={styles['preview-icon']} size={30} />
  }
  if (mimeType.startsWith('video/')) {
    return <FaFileVideo className={styles['preview-icon']} size={30} />
  }
  if (mimeType.startsWith('audio/')) {
    return <FaFileAudio className={styles['preview-icon']} size={30} />
  }
  switch (mimeType) {
    case 'application/pdf':
      return <FaFilePdf className={styles['preview-icon']} size={30} />
    case 'application/msword':
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return <FaFileWord className={styles['preview-icon']} size={30} />
    case 'application/vnd.ms-excel':
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      return <FaFileExcel className={styles['preview-icon']} size={30} />
    default:
      return <FaFile className={styles['preview-icon']} size={30} />
  }
}

const OtherFileMessageItem: React.FC<OtherFileMessageItemProps> = ({
  fileMap,
  localExist,
  fileState,
  isMine,
  onFileAction,
  onOpenFile
}: OtherFileMessageItemProps) => {
  if (!fileMap) return null

  const icon = getIconByMIME(fileMap.mimeType)
  const isUploading =
    fileState.operation === 'upload' && fileState.progress > 0 && fileState.progress < 100
  const isDownloading =
    fileState.operation === 'download' && fileState.progress > 0 && fileState.progress < 100

  // 渲染文件操作控件
  const renderFileControls = (): React.ReactNode => {
    // 上传中状态 - 进度条从左到右填充，已上传部分高亮
    if (isUploading) {
      return (
        <div className={styles['file-progress-container']}>
          {/* 渐变遮罩层 - 已上传部分清晰，未上传部分变暗 */}
          <div
            className={styles['progress-mask']}
            style={{
              background: `linear-gradient(
                to right,
                transparent ${fileState.progress}%,
                rgba(0, 0, 0, 0.3) ${fileState.progress}%
              )`
            }}
          />
          <div
            className={styles['file-progress-bar']}
            style={{ width: `${fileState.progress}%` }}
          />
          <span className={styles['progress-text']}>上传中 {fileState.progress}%</span>
        </div>
      )
    }

    // 下载中状态 - 进度条从左到右填充，已下载部分高亮
    if (isDownloading) {
      return (
        <div className={styles['file-progress-container']}>
          {/* 渐变遮罩层 - 已下载部分清晰，未下载部分变暗 */}
          <div
            className={styles['progress-mask']}
            style={{
              background: `linear-gradient(
                to right,
                transparent ${fileState.progress}%,
                rgba(0, 0, 0, 0.3) ${fileState.progress}%
              )`
            }}
          />
          <div
            className={styles['file-progress-bar']}
            style={{ width: `${fileState.progress}%` }}
          />
          <span className={styles['progress-text']}>下载中 {fileState.progress}%</span>
        </div>
      )
    }

    // 错误状态
    if (fileState.errorInfo) {
      return (
        <div className={styles['file-error-container']}>
          <span className={styles['error-text']}>
            {fileState.operation === 'upload' ? '上传' : '下载'}失败
          </span>
          <button
            className={styles['retry-button']}
            onClick={(e) => {
              e.stopPropagation()
              onFileAction('retry')
            }}
          >
            <FaRotateRight size={14} /> 重试
          </button>
        </div>
      )
    }

    // 未下载状态
    if (!localExist) {
      return (
        <button
          className={styles['download-button']}
          onClick={(e) => {
            e.stopPropagation()
            onFileAction('download')
          }}
        >
          <FaDownload size={14} /> 下载
        </button>
      )
    }

    // 已下载状态
    return (
      <button
        className={styles['open-button']}
        onClick={(e) => {
          e.stopPropagation()
          onOpenFile()
        }}
      >
        另存文件
      </button>
    )
  }

  return (
    <div
      className={`${isMine ? styles['media-container-mine'] : styles['media-container-others']}`}
    >
      <div
        className={`${isMine ? styles['content-file-wrapper-mine'] : styles['content-file-wrapper-others']}`}
        onClick={onOpenFile}
      >
        {/* 进度状态下的图标高亮效果 */}
        <div
          className={`${styles['content-icon']} ${isUploading || isDownloading ? styles['icon-active'] : ''}`}
        >
          {icon || <FaFile className={styles['preview-icon']} size={30} />}
        </div>
        <div className={styles['file-info']}>
          <span className={styles['content-file-name']}>{fileMap.originName}</span>
          {fileMap.size && (
            <span className={styles['content-file-size']}>{formatFileSize(fileMap.size)}</span>
          )}
          {renderFileControls()}
        </div>
      </div>
    </div>
  )
}

export default OtherFileMessageItem
