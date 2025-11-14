import styles from './ImageMessageItem.module.css'
import { FaDownload, FaRotateRight, FaEye } from 'react-icons/fa6'
import { formatFileSize } from '@shared/utils'
import { FileOperationState } from '../FileMessageItem'
import LocalImage from '@renderer/pages/home/components/LocalImage'
import { ChatMessage, FileMap } from '@shared/types'

interface ImageMessageItemProps {
  fileMap: FileMap
  message: ChatMessage
  localExist: boolean
  fileState: FileOperationState
  isMine: boolean
  onFileAction: (action: 'download' | 'retry') => void
  onOpenFile: () => void
}

const ImageMessageItem: React.FC<ImageMessageItemProps> = ({
  fileMap,
  message,
  localExist,
  fileState,
  isMine,
  onFileAction,
  onOpenFile
}: ImageMessageItemProps) => {
  const base64 = message.content.split(':')[3]
  // 渲染缩略图上的操作按钮
  // 渲染缩略图上的操作按钮
  const renderOverlayControls = (): React.ReactNode => {
    // 下载中状态 - 已下载部分在上，未下载部分在下（更暗）
    if (fileState.operation === 'download' && fileState.progress >= 0 && fileState.progress < 100) {
      return (
        <div className={styles['file-overlay']}>
          {/* 下载进度遮罩层 - 从上到下填充 */}
          <div
            className={styles['progress-mask']}
            style={{
              background: `linear-gradient(
              to bottom,
              transparent ${fileState.progress}%,
              rgba(0, 0, 0, 0.6) ${fileState.progress}%
            )`
            }}
          />

          <div className={styles['progress-circle']}>
            <div
              className={styles['progress-ring']}
              style={{
                strokeDasharray: '283',
                strokeDashoffset: `${283 - (283 * fileState.progress) / 100}`
              }}
            />
            <span className={styles['progress-text']}>{fileState.progress}%</span>
          </div>
        </div>
      )
    }

    // 上传中状态 - 已上传部分在下，未上传部分在上（更暗）
    if (fileState.operation === 'upload' && fileState.progress >= 0 && fileState.progress < 100) {
      return (
        <div className={styles['file-overlay']}>
          {/* 上传进度遮罩层 - 从下到上填充 */}
          <div
            className={styles['progress-mask']}
            style={{
              background: `linear-gradient(
              to top,
              transparent ${fileState.progress}%,
              rgba(0, 0, 0, 0.6) ${fileState.progress}%
            )`
            }}
          />

          <div className={styles['progress-circle']}>
            <div
              className={styles['progress-ring']}
              style={{
                strokeDasharray: '283',
                strokeDashoffset: `${283 - (283 * fileState.progress) / 100}`
              }}
            />
            <span className={styles['progress-text']}>{fileState.progress}%</span>
          </div>
        </div>
      )
    }

    // 错误状态（保持不变）
    if (fileState.errorInfo) {
      return (
        <div className={styles['file-overlay']}>
          <button
            className={styles['overlay-button']}
            onClick={(e) => {
              e.stopPropagation()
              onFileAction('retry')
            }}
          >
            <FaRotateRight size={20} />
          </button>
          <span className={styles['overlay-error']}>{fileState.errorInfo}</span>
        </div>
      )
    }

    // 未下载状态（保持不变）
    if (!localExist) {
      return (
        <div className={styles['file-overlay']}>
          <button
            className={styles['overlay-button']}
            onClick={(e) => {
              e.stopPropagation()
              onFileAction('download')
            }}
          >
            <FaDownload size={20} />
          </button>
        </div>
      )
    }

    // 已下载状态（保持不变）
    return (
      <div className={styles['file-overlay-hover']}>
        <button
          className={styles['overlay-button']}
          onClick={(e) => {
            e.stopPropagation()
            onOpenFile()
          }}
        >
          <FaEye size={20} />
        </button>
      </div>
    )
  }

  return (
    <div className={styles['media-container']}>
      <div
        className={`${styles['content-image-wrapper']} ${isMine ? styles['mine'] : styles['others']}`}
        onClick={onOpenFile}
      >
        {localExist ? (
          <LocalImage
            className={styles['content-image-show']}
            fileName={fileMap.remoteName}
            option="image"
          />
        ) : (
          <img
            src={`data:image/${fileMap.mimeType};base64,${base64}`}
            alt={fileMap.originName}
            className={styles['content-image-show']}
          />
        )}

        {fileMap.size > 0 && (
          <span className={styles['content-image-size']}>{formatFileSize(fileMap.size)}</span>
        )}

        {renderOverlayControls()}
      </div>
    </div>
  )
}

export default ImageMessageItem
