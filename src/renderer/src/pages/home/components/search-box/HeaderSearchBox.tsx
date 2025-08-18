import { FaPlus, FaSearch } from 'react-icons/fa'
import styles from './HeaderSearchBox.module.css'
import { ChangeEvent, useState, useEffect, useRef } from 'react'

// 定义组件属性接口
interface HeaderSearchBoxProps {
  // 搜索输入变化时的回调，返回要渲染的结果组件
  searchCallBack: (value: string) => React.ReactNode
  // 自定义占位符
  placeholder?: string
  addClickCallBack: () => void
}

const HeaderSearchBox: React.FC<HeaderSearchBoxProps> = ({
  searchCallBack,
  placeholder = '搜索',
  addClickCallBack
}: HeaderSearchBoxProps) => {
  const [content, setContent] = useState('')
  const [showResult, setShowResult] = useState(false)
  const [result, setResult] = useState<React.ReactNode>(<div></div>)
  const searchContainerRef = useRef<HTMLDivElement>(null)

  // 处理输入变化
  const handleContentChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const value = e.target.value.trim()
    setContent(value)
    // 调用外部回调获取结果组件
    setResult(searchCallBack(value))
    setShowResult(!!value)
  }

  // 点击外部关闭结果面板
  const handleClickOutside = (e: MouseEvent): void => {
    if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
      setShowResult(false)
    }
  }

  // 监听全局点击事件
  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  return (
    <div className={styles['search-container']} ref={searchContainerRef}>
      <div className={styles['search-bar']}>
        <div className={styles['search-icon']}>
          <FaSearch />
        </div>
        <input
          type="text"
          className={styles['search-text']}
          placeholder={placeholder}
          value={content}
          onChange={handleContentChange}
          onFocus={() => content && setShowResult(true)}
          // 修正：没有onNotFocus事件，使用onBlur
          onBlur={() => setTimeout(() => setShowResult(false), 200)}
        />

        {showResult && <div className={styles['search-result-div']}>{result}</div>}
      </div>

      <button className={styles['add-button']} onClick={addClickCallBack}>
        <FaPlus />
      </button>
    </div>
  )
}

export default HeaderSearchBox
