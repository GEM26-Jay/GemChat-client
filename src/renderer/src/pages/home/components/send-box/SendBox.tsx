import {
  FaCropAlt,
  FaFile,
  FaFileImage,
  FaHistory,
  FaMicrophone,
  FaPaperclip,
  FaSmile,
  FaVideo,
  FaFilePdf,
  FaFileWord,
  FaFileExcel,
  FaFileAudio,
  // FaSpinner,
  FaFileVideo
} from 'react-icons/fa'
import { FaXmark } from 'react-icons/fa6'
import styles from './SendBox.module.css'
import { useState, useRef, useEffect } from 'react'
import { ApiResult, MessageType, MimeContentTypeMap, UniversalFile } from '@shared/types'
import {
  calculateFileFingerprint,
  fileToBuffer,
  formatFileSize,
  getMIMEFromFilename,
  MIME
} from '@shared/utils'

// 附件类型接口（使用文件指纹作为ID）
interface AttachItem extends UniversalFile {
  icon: React.ReactNode
}

// 组件Props
interface SendBoxProps {
  sessionId: string
  handleSendText: (sessionId: string, content: string) => Promise<void>
  handleSendFile: (sessionId: string, file: UniversalFile) => Promise<void>
}

// 工具函数：根据MIME类型获取消息类型和显示图标
const getFileMetaByMIME = (mimeType: MIME): { type: MessageType; icon: React.ReactNode } => {
  if (mimeType.startsWith('image/')) {
    return {
      type: MessageType.TYPE_IMAGE,
      icon: <FaFileImage className={styles['preview-icon']} />
    }
  }
  if (mimeType.startsWith('video/')) {
    return {
      type: MessageType.TYPE_VIDEO,
      icon: <FaFileVideo className={styles['preview-icon']} />
    }
  }
  if (mimeType.startsWith('audio/')) {
    return {
      type: MessageType.TYPE_VOICE,
      icon: <FaFileAudio className={styles['preview-icon']} />
    }
  }
  switch (mimeType) {
    case 'application/pdf':
      return { type: MessageType.TYPE_FILE, icon: <FaFilePdf className={styles['preview-icon']} /> }
    case 'application/msword':
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return {
        type: MessageType.TYPE_FILE,
        icon: <FaFileWord className={styles['preview-icon']} />
      }
    case 'application/vnd.ms-excel':
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      return {
        type: MessageType.TYPE_FILE,
        icon: <FaFileExcel className={styles['preview-icon']} />
      }
    default:
      return { type: MessageType.TYPE_FILE, icon: <FaFile className={styles['preview-icon']} /> }
  }
}

// 在组件中添加转换函数
const arrayBufferToDataUrl = (buffer: ArrayBuffer, mimeType: string = 'image/jpeg'): string => {
  // 将ArrayBuffer转换为Blob
  const blob = new Blob([buffer], { type: mimeType })
  // 生成Blob URL
  return URL.createObjectURL(blob)
}

const SendBox: React.FC<SendBoxProps> = ({
  sessionId,
  handleSendText,
  handleSendFile
}: SendBoxProps) => {
  const [text, setText] = useState('')
  const [attaches, setAttaches] = useState<AttachItem[]>([])
  const [isSendingText, setIsSendingText] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // 处理粘贴文件（计算指纹后添加，限制100MB以内）
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent): Promise<void> => {
      const items = e.clipboardData?.items
      if (!items) return

      // 定义100MB的字节数 (100 * 1024 * 1024)
      const MAX_FILE_SIZE = 104857600

      for (const item of Array.from(items)) {
        if (item.kind === 'file' && item.type) {
          const file = item.getAsFile()
          console.log('handlePaste', file)

          if (file) {
            // 检查文件大小
            if (file.size > MAX_FILE_SIZE) {
              // 文件过大，显示提示并跳过处理
              alert(
                `文件 "${file.name}" 太大（${formatFileSize(file.size)}），请使用文件选择上传（最大支持100MB）`
              )
              continue
            }

            e.preventDefault()
            try {
              console.log('handlePaste', file)
              // 将文件转换为Buffer
              const fileBuffer = await fileToBuffer(file)
              // 计算文件指纹（忽略文件名）
              const fileFingerprint = await calculateFileFingerprint(fileBuffer)

              const mimeType =
                getMIMEFromFilename(file.name) || (file.type as MIME) || 'application/octet-stream'
              const universalFile: UniversalFile = {
                fileName: file.name,
                mimeType,
                fileSize: file.size,
                localPath: '',
                contentType: 'ArrayBuffer',
                content: fileBuffer,
                fingerprint: fileFingerprint // 添加指纹属性
              }

              addAttach({
                ...universalFile,
                icon: getFileMetaByMIME(mimeType).icon
              })
            } catch (error) {
              alert(
                `处理粘贴文件 ${file.name} 失败: ${error instanceof Error ? error.message : '未知错误'}`
              )
            }
          }
        }
      }
    }

    // 辅助函数：格式化文件大小为人类可读形式
    const formatFileSize = (bytes: number): string => {
      if (bytes >= 1024 * 1024) {
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
      } else if (bytes >= 1024) {
        return `${(bytes / 1024).toFixed(2)} KB`
      }
      return `${bytes} B`
    }

    const textarea = textareaRef.current
    textarea?.addEventListener('paste', handlePaste)
    return () => textarea?.removeEventListener('paste', handlePaste)
  }, [])

  // 处理文件选择（计算指纹后添加）
  const handleFileSelect = async (): Promise<void> => {
    try {
      // 调用文件选择对话框API，获取Buffer格式的文件内容
      const filesApi: ApiResult<UniversalFile[]> = await window.fileManager.openFileDialog({
        'image/*': 'ArrayBuffer'
      } as MimeContentTypeMap)

      if (!filesApi.isSuccess || !filesApi.data || filesApi.data.length === 0) {
        // 选择文件取消后重新聚焦输入框
        textareaRef.current?.focus()
        return
      }

      // 遍历选中的文件
      for (const file of filesApi.data) {
        console.log('handleFileSelect', file)
        try {
          const enrichedFile: AttachItem = {
            ...file,
            icon: getFileMetaByMIME(file.mimeType).icon
          }

          setAttaches((prev) => [...prev, enrichedFile])
        } catch (error) {
          alert(
            `处理文件 ${file.fileName} 失败: ${error instanceof Error ? error.message : '未知错误'}`
          )
        }
      }
      // 选择文件完成后重新聚焦输入框
      textareaRef.current?.focus()
    } catch (error) {
      console.error('文件选择过程出错:', error)
      alert(`文件选择失败: ${error instanceof Error ? error.message : '未知错误'}`)
      // 出错后也重新聚焦
      textareaRef.current?.focus()
    }
  }

  // 添加附件（基于指纹去重）
  const addAttach = (file: AttachItem): void => {
    if (!file) return
    const isDuplicate = attaches.some((attach) => attach?.fingerprint === file?.fingerprint)
    if (isDuplicate) {
      alert(`已添加相同内容的文件（当前文件名：${file.fileName}）`)
      return
    }
    if (!file.fileSize) return
    const maxSize = 500 * 1024 * 1024
    if (file.fileSize > maxSize) {
      alert(`文件过大（${formatFileSize(file.fileSize)}），请选择小于500MB的文件`)
      return
    }

    const { icon } = getFileMetaByMIME(file.mimeType)
    const newAttach: AttachItem = {
      ...file,
      icon
    }

    setAttaches((prev) => [...prev, newAttach])
  }

  // 移除附件
  const removeAttach = (fingerprint: string): void => {
    setAttaches((prev) => prev.filter((attach) => attach.fingerprint !== fingerprint))
    // 移除附件后保持焦点
    textareaRef.current?.focus()
  }

  // 上传单个文件
  const uploadSingleFile = async (attach: AttachItem): Promise<void> => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { icon, ...universalFile } = attach
      handleSendFile(sessionId, universalFile)
    } catch (error) {
      console.error(error instanceof Error ? error.message : `文件 ${attach.fileName} 上传异常`)
    }
  }

  // 批量上传待传文件
  const uploadAllPendingFiles = async (): Promise<void> => {
    console.log('attaches', attaches)
    for (const attach of attaches) {
      await uploadSingleFile(attach)
    }
    setAttaches([])
  }

  // 发送消息 - 核心修改：确保发送后聚焦
  const sendMessage = async (): Promise<void> => {
    await uploadAllPendingFiles()

    const trimmedText = text.trim()
    if (trimmedText && !isSendingText) {
      setIsSendingText(true)
      try {
        await handleSendText(sessionId, trimmedText)
      } catch (error) {
        alert(`文本发送异常：${error instanceof Error ? error.message : '未知错误'}`)
      } finally {
        setIsSendingText(false)
        setText('')
        // 关键：发送完成后强制聚焦输入框
        textareaRef.current?.focus()
      }
    } else {
      // 没有文本但有附件时，上传完成后也聚焦
      textareaRef.current?.focus()
    }
  }

  // 键盘事件处理
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key !== 'Enter') return

    if (e.shiftKey) {
      e.preventDefault()
      const textarea = e.target as HTMLTextAreaElement
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      setText(text.slice(0, start) + '\n' + text.slice(end))
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 1
      }, 0)
    } else {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className={styles['send-box-wrapper']}>
      {/* 工具栏 */}
      <div className={styles['chat-toolbar']}>
        <div className={styles['chat-toolbar-left']}>
          <button
            className={styles['toolbar-button']}
            title="表情"
            disabled={isSendingText}
            onClick={() => textareaRef.current?.focus()} // 点击后保持焦点
          >
            <FaSmile className={styles['toolbar-button-icon']} />
          </button>
          <button
            className={styles['toolbar-button']}
            title="选择文件"
            disabled={isSendingText}
            onClick={handleFileSelect} // 修复：移除错误的箭头函数包裹
          >
            <FaPaperclip className={styles['toolbar-button-icon']} />
          </button>
          <button
            className={styles['toolbar-button']}
            title="截图"
            disabled={isSendingText}
            onClick={() => textareaRef.current?.focus()}
          >
            <FaCropAlt className={styles['toolbar-button-icon']} />
          </button>
          <button
            className={styles['toolbar-button']}
            title="聊天记录"
            disabled={isSendingText}
            onClick={() => textareaRef.current?.focus()}
          >
            <FaHistory className={styles['toolbar-button-icon']} />
          </button>
        </div>
        <div className={styles['chat-toolbar-right']}>
          <button
            className={styles['toolbar-button']}
            title="语音"
            disabled={isSendingText}
            onClick={() => textareaRef.current?.focus()}
          >
            <FaMicrophone className={styles['toolbar-button-icon']} />
          </button>
          <button
            className={styles['toolbar-button']}
            title="视频"
            disabled={isSendingText}
            onClick={() => textareaRef.current?.focus()}
          >
            <FaVideo className={styles['toolbar-button-icon']} />
          </button>
        </div>
      </div>

      {/* 输入框与附件区 */}
      <div className={styles['sendbox']}>
        <textarea
          ref={textareaRef}
          className={styles['sendbox-text']}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="请输入消息（Shift+Enter换行，粘贴文件可添加附件）"
          rows={4}
        />

        {/* 附件列表 */}
        {attaches.length > 0 && (
          <ul className={styles['sendbox-attaches']}>
            {attaches.map((attach) => (
              <li key={attach.fingerprint} className={styles['sendbox-attach-item']}>
                <div className={styles['sendbox-attach-info']}>
                  <span>{attach.fileName}</span>
                </div>
                <div className={styles['sendbox-attach-show']}>
                  {attach.mimeType.startsWith('image/') ? (
                    <img
                      src={arrayBufferToDataUrl(attach.content as ArrayBuffer, attach.mimeType)}
                      alt={attach.fileName || '预览图片'}
                      className={styles['preview-img']}
                      onLoad={(e) => URL.revokeObjectURL((e.target as HTMLImageElement).src)}
                    />
                  ) : (
                    attach.icon
                  )}
                </div>
                <button
                  className={styles['sendbox-attach-cancel-btn']}
                  onClick={(e) => {
                    e.stopPropagation()
                    removeAttach(attach.fingerprint as string)
                  }}
                >
                  <FaXmark className={styles['sendbox-attach-cancel']} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export default SendBox
