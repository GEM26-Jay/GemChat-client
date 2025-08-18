import {
  FaCropAlt,
  FaFile,
  FaHistory,
  FaMicrophone,
  FaPaperclip,
  FaSmile,
  FaTimesCircle,
  FaVideo
} from 'react-icons/fa'
import styles from './SendBox.module.css'
import { useState } from 'react'

export interface AttachType {
  id: string
  icon: React.ReactNode
  fileName: string
}

const SendBox: React.FC = () => {
  const [text, setText] = useState('')
  const [attaches, setAttaches] = useState<AttachType[]>([
    {
      id: '1',
      icon: <FaFile />,
      fileName: '测试文件1'
    },
    {
      id: '2',
      icon: <FaFile />,
      fileName: '测试文件2'
    },
    {
      id: '3',
      icon: <FaFile />,
      fileName: '测试文件3'
    },
    {
      id: '4',
      icon: <FaFile />,
      fileName: '测试文件4'
    },
    {
      id: '5',
      icon: <FaFile />,
      fileName: '测试文件5'
    },
    {
      id: '6',
      icon: <FaFile />,
      fileName: '测试文件6'
    },
    {
      id: '7',
      icon: <FaFile />,
      fileName: '测试文件7'
    }
  ])

  // 模拟添加附件的方法，实际可结合文件上传等功能
  const addAttach = (): void => {
    const newAttach: AttachType = {
      id: Date.now().toString(),
      icon: <FaFile />,
      fileName: `文件_${Date.now()}.txt`
    }
    setAttaches([...attaches, newAttach])
  }

  return (
    <div className={styles['send-box-wrapper']}>
      {/* 工具栏（可扩展表情、图片等功能） */}
      <div className={styles['chat-toolbar']}>
        <div className={styles['chat-toolbar-left']}>
          <button className={styles['toolbar-button']} title="表情">
            <FaSmile className={styles['toolbar-button-icon']} />
          </button>
          <button className={styles['toolbar-button']} title="文件">
            <FaPaperclip className={styles['toolbar-button-icon']} />
          </button>
          <button className={styles['toolbar-button']} title="截图">
            <FaCropAlt className="toolbar-button-icon" />
          </button>
          <button className={styles['toolbar-button']} title="聊天记录">
            <FaHistory className="toolbar-button-icon" />
          </button>
        </div>
        <div className={styles['chat-toolbar-right']}>
          <button className={styles['toolbar-button']} title="语音">
            <FaMicrophone className={styles['toolbar-button-icon']} />
          </button>
          <button className={styles['toolbar-button']} title="视频">
            <FaVideo className={styles['toolbar-button-icon']} />
          </button>
        </div>
      </div>
      {/* 消息发送区域 */}
      <div className={styles['sendbox']}>
        <textarea
          className={styles['sendbox-text']}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        {attaches.length > 0 && (
          <ul className={styles['sendbox-attaches']}>
            {attaches.map((element) => (
              <li key={element.id} className={styles['sendbox-attach-item']}>
                <div title={element.fileName} className={styles['sendbox-attach-icon']}>
                  {element.icon}
                </div>
                <div className={styles['sendbox-attach-filename']}>
                  <span>{element.fileName}</span>
                </div>
                <button className={styles['sendbox-attach-delete-bn']}>
                  <FaTimesCircle />
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
