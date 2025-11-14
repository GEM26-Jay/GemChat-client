import { useState, useEffect } from 'react'
import { FaSearch } from 'react-icons/fa'
import styles from './FileBox.module.css'
import { FileMap } from '@shared/types'
import FileBoxItem from './FileBoxItem'
import { MIME } from '@shared/utils'

// 定义文件分类类型
type FileCategory = 'all' | 'image' | 'document' | 'video' | 'audio' | 'other'

const isDocument = (mimeType: MIME): boolean => {
  // 文本类文档（text/开头）
  if (mimeType.startsWith('text/')) return true
  // PDF
  if (mimeType === 'application/pdf') return true
  // Word 系列
  if (
    mimeType === 'application/msword' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  )
    return true
  // Excel 系列
  if (
    mimeType === 'application/vnd.ms-excel' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  )
    return true
  // PPT 系列
  if (
    mimeType === 'application/vnd.ms-powerpoint' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  )
    return true
  return false
}

const isImage = (mimeType: MIME): boolean => mimeType.startsWith('image/')
const isVideo = (mimeType: MIME): boolean => mimeType.startsWith('video/')
const isAudio = (mimeType: MIME): boolean => mimeType.startsWith('audio/')

const FileBox: React.FC = () => {
  const [files, setFiles] = useState<FileMap[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [activeCategory, setActiveCategory] = useState<FileCategory>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 获取文件列表数据
  const fetchFiles = async (): Promise<void> => {
    try {
      setLoading(true)
      const filesApi = await window.businessApi.file.getAllSynced()
      if (!filesApi.isSuccess || !filesApi.data) throw new Error('Failed to fetch files')
      const data: FileMap[] = filesApi.data
      setFiles(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load files')
      console.error('Error fetching files:', err)
    } finally {
      setLoading(false)
    }
  }

  // 初始加载和分类/搜索变化时重新获取数据
  useEffect(() => {
    fetchFiles()
  }, [])

  // 过滤文件
  const filteredFiles = files.filter((file) => {
    // 搜索过滤
    const matchesSearch = file.originName.toLowerCase().includes(searchTerm.toLowerCase())

    // 分类过滤
    const matchesCategory =
      activeCategory === 'all' ||
      (activeCategory === 'document' && isDocument(file.mimeType as MIME)) ||
      (activeCategory === 'image' && isImage(file.mimeType as MIME)) ||
      (activeCategory === 'video' && isVideo(file.mimeType as MIME)) ||
      (activeCategory === 'audio' && isAudio(file.mimeType as MIME)) ||
      (activeCategory === 'other' &&
        !isImage(file.mimeType as MIME) &&
        !isVideo(file.mimeType as MIME) &&
        !isAudio(file.mimeType as MIME) &&
        !isDocument(file.mimeType as MIME))

    return matchesSearch && matchesCategory
  })

  return (
    <div className={styles['file-box-wrapper']}>
      <div className={styles['file-box-header']}>
        <div className={styles['search-area']}>
          <FaSearch className={styles['search-icon']} />
          <input
            type="text"
            placeholder="搜索文件..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles['search-input']}
          />
        </div>
      </div>

      <div className={styles['file-box-nav']}>
        <div className={styles['file-classes']}>
          <ol>
            <li
              className={activeCategory === 'all' ? styles['active'] : ''}
              onClick={() => setActiveCategory('all')}
            >
              全部
            </li>
            <li
              className={activeCategory === 'image' ? styles['active'] : ''}
              onClick={() => setActiveCategory('image')}
            >
              图片
            </li>
            <li
              className={activeCategory === 'document' ? styles['active'] : ''}
              onClick={() => setActiveCategory('document')}
            >
              文档
            </li>
            <li
              className={activeCategory === 'video' ? styles['active'] : ''}
              onClick={() => setActiveCategory('video')}
            >
              视频
            </li>
            <li
              className={activeCategory === 'audio' ? styles['active'] : ''}
              onClick={() => setActiveCategory('audio')}
            >
              音频
            </li>
            <li
              className={activeCategory === 'other' ? styles['active'] : ''}
              onClick={() => setActiveCategory('other')}
            >
              其他
            </li>
          </ol>
        </div>
      </div>

      <div className={styles['file-box-body']}>
        {loading ? (
          <div className={styles['loading']}>加载中...</div>
        ) : error ? (
          <div className={styles['error']}>
            {error} <button onClick={fetchFiles}>重试</button>
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className={styles['empty']}>没有找到匹配的文件</div>
        ) : (
          <ul className={styles['file-list']}>
            {filteredFiles.map((item) => (
              <li key={item.id || item.fingerprint} className={styles['file-list-item']}>
                <FileBoxItem file={item} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export default FileBox
