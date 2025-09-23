import styles from './FileBoxItem.module.css'
import { FileMap } from '@shared/types'
import {
  FaFile,
  FaFileAudio,
  FaFileExcel,
  FaFileImage,
  FaFilePdf,
  FaFileVideo,
  FaFileWord
} from 'react-icons/fa6'
import { formatDate, formatFileSize } from '@shared/utils'

// 根据MIME类型获取显示图标
const getIconByMIME = (mimeType: string): React.ReactNode => {
  if (mimeType.startsWith('image/')) {
    return <FaFileImage className={styles['preview-icon']} />
  }
  if (mimeType.startsWith('video/')) {
    return <FaFileVideo className={styles['preview-icon']} />
  }
  if (mimeType.startsWith('audio/')) {
    return <FaFileAudio className={styles['preview-icon']} />
  }
  switch (mimeType) {
    case 'application/pdf':
      return <FaFilePdf className={styles['preview-icon']} />
    case 'application/msword':
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return <FaFileWord className={styles['preview-icon']} />
    case 'application/vnd.ms-excel':
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      return <FaFileExcel className={styles['preview-icon']} />
    default:
      return <FaFile className={styles['preview-icon']} />
  }
}

const FileBoxItem: React.FC<{ file: FileMap }> = ({ file }: { file: FileMap }) => {
  return (
    <div className={styles['file-box-item-wrapper']}>
      <div className={styles['file-icon']}>
        {file.mimeType.startsWith('image/') ? (
          <img src={file.location} alt={file.originName} className={styles['image-preview']} />
        ) : (
          getIconByMIME(file.mimeType)
        )}
      </div>
      <div className={styles['file-main']}>
        <div className={styles['file-name']} title={file.originName}>
          {file.originName}
        </div>
        <div className={styles['file-source']}>{file.sourceInfo}</div>
      </div>
      <div className={styles['file-info']}>
        <div className={styles['file-time']}>{formatDate(file.updatedAt)}</div>
        <div className={styles['file-size']}>{formatFileSize(Number(file.size))}</div>
      </div>
    </div>
  )
}

export default FileBoxItem
