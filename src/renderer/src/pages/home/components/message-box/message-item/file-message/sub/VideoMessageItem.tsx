import styles from './VideoMessageItem.module.css'
import { FaDownload, FaRotateRight, FaPlay } from 'react-icons/fa6'
import { formatFileSize } from '@shared/utils'
import { FileOperationState } from '../FileMessageItem'
import { ChatMessage, FileMap } from '@shared/types'

interface VideoMessageItemProps {
  fileMap: FileMap
  message: ChatMessage
  localExist: boolean
  fileState: FileOperationState
  isMine: boolean
  onFileAction: (action: 'download' | 'retry') => void
  onOpenFile: () => void
}

const VideoMessageItem: React.FC<VideoMessageItemProps> = ({
  fileMap,
  message,
  localExist,
  fileState,
  isMine,
  onFileAction,
  onOpenFile
}: VideoMessageItemProps) => {
  // 渲染缩略图上的操作按钮（添加进度遮罩效果）
  const renderOverlayControls = (): React.ReactNode => {
    // 下载中状态 - 已下载部分在上，未下载部分在下（更暗）
    if (fileState.operation === 'download' && fileState.progress > 0 && fileState.progress < 100) {
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
            <svg>
              <circle
                cx="30"
                cy="30"
                r="45"
                className={styles['progress-ring']}
                style={{
                  strokeDasharray: '283',
                  strokeDashoffset: `${283 - (283 * fileState.progress) / 100}`
                }}
              />
            </svg>
            <span className={styles['progress-text']}>{fileState.progress}%</span>
          </div>
        </div>
      )
    }

    // 上传中状态 - 已上传部分在下，未上传部分在上（更暗）
    if (fileState.operation === 'upload' && fileState.progress > 0 && fileState.progress < 100) {
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
            <svg>
              <circle
                cx="30"
                cy="30"
                r="45"
                className={styles['progress-ring']}
                style={{
                  strokeDasharray: '283',
                  strokeDashoffset: `${283 - (283 * fileState.progress) / 100}`
                }}
              />
            </svg>
            <span className={styles['progress-text']}>{fileState.progress}%</span>
          </div>
        </div>
      )
    }

    // 错误状态
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

    // 未下载状态
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

    // 已下载状态（显示播放按钮）
    return (
      <div className={styles['file-overlay-hover']}>
        <button
          className={styles['overlay-button']}
          onClick={(e) => {
            e.stopPropagation()
            onOpenFile()
          }}
        >
          <FaPlay size={20} />
        </button>
      </div>
    )
  }

  const base64 = message.content.split(':')[3]
  return (
    <div className={styles['media-container']}>
      <div
        className={`${styles['content-video-wrapper']} ${isMine ? styles['mine'] : styles['others']}`}
        onClick={onOpenFile}
      >
        <img
          src={`data:image/${fileMap.mimeType};base64,${base64}`}
          alt={fileMap.originName}
          className={styles['content-video-thumbnail']}
        />
        {/* 仅在非操作状态显示默认播放按钮 */}
        {!fileState.operation && !fileState.errorInfo && localExist && (
          <div className={styles['video-play-icon']}>
            <FaPlay size={24} />
          </div>
        )}

        {fileMap.size > 0 && (
          <span className={styles['content-file-size']}>{formatFileSize(fileMap.size)}</span>
        )}

        {renderOverlayControls()}
      </div>
    </div>
  )
}

export default VideoMessageItem
