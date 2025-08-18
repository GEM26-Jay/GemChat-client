import React, { JSX, useState, useEffect } from 'react'
import 'modern-normalize/modern-normalize.css'
import styles from './SearchUserBoard.module.css'
import { FaCircle, FaSearch, FaTimes } from 'react-icons/fa'
import { FaMars, FaVenus } from 'react-icons/fa6'
import LocalImage from '../home/components/LocalImage'
import { useNavigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { useDispatch, useSelector } from 'react-redux'
import { RootState, setKeyword } from './store'

const SearchUserBoard: React.FC = () => {
  const [searchText, setSearchText] = useState('')
  const [lastSearchedText, setLastSearchedText] = useState('')
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const keyword = useSelector((state: RootState) => state.search.keyword)

  const {
    data: list,
    isLoading,
    error
  } = useQuery({
    queryKey: ['userSearch', lastSearchedText],
    queryFn: () =>
      window.businessApi.user.searchUserBlur(lastSearchedText).then((res) => {
        if (!res.isSuccess) throw new Error(res.msg)
        return res.data || []
      }),
    staleTime: 5 * 60 * 1000,
    enabled: lastSearchedText !== ''
  })

  // 手动触发搜索
  const handleSearch = async (): Promise<void> => {
    const trimmedText = searchText.trim()
    if (trimmedText) {
      setLastSearchedText(trimmedText)
      dispatch(setKeyword(trimmedText))
    }
  }

  // 清除搜索内容
  const clearSearch = (): void => {
    setSearchText('')
    dispatch(setKeyword(''))
  }

  // 按回车键搜索
  const handleKeyPress = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter' && !isLoading) {
      handleSearch()
    }
  }

  // 性别指示器组件
  const GenderIndicator = ({ gender }: { gender: number }): JSX.Element | null => {
    if (gender === 1) return <FaMars className={styles.genderMale} />
    if (gender === 2) return <FaVenus className={styles.genderFemale} />
    return null
  }

  // 初始化时恢复状态（仅一次）
  useEffect(() => {
    // 状态恢复
    if (keyword && !searchText) {
      // 只有当searchText为空时才恢复
      setSearchText(keyword)
      handleSearch()
    }
  }, [handleSearch, keyword, searchText])

  return (
    <div className={styles.container}>
      {/* 头部 */}
      <div className={styles.header}>
        <h2>添加好友</h2>
      </div>

      {/* 主体内容 */}
      <div className={styles.body}>
        {/* 搜索框 */}
        <div className={styles['search-box']}>
          <input
            className={styles['search-text']}
            placeholder="搜索用户名、手机号或邮箱"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isLoading}
          />

          {searchText && (
            <FaTimes
              className={styles['search-clean']}
              onClick={clearSearch}
              title="清除搜索内容"
            />
          )}

          <button
            className={styles['search-btn']}
            onClick={handleSearch}
            title="搜索"
            disabled={isLoading || !searchText.trim()}
          >
            {isLoading ? <FaCircle className={styles.loading} /> : <FaSearch />}
          </button>
        </div>

        {/* 错误提示 */}
        {error && <div className={styles.errorMessage}>搜索失败: {error.message}</div>}
        {list && list.length === 0 && (
          <div className={styles.errorMessage}>搜索失败: 该用户不存在</div>
        )}
        {/* 搜索结果列表 */}
        {list && list.length !== 0 && (
          <div className={styles['result-container']}>
            {isLoading ? (
              <div className={styles['searching']}>搜索中...</div>
            ) : list.length > 0 ? (
              <ul className={styles['search-list']}>
                {list.map((item) => (
                  <li key={item.id} className={styles['user-item']}>
                    <LocalImage className={styles['user-avatar']} fileName={item.avatar} />
                    <div className={styles['user-info']}>
                      <div className={styles['user-name-section']}>
                        <span className={styles['user-name']}>{item.username}</span>
                        <GenderIndicator gender={item.gender} />
                      </div>

                      <div className={styles['user-details']}>
                        {item.signature && (
                          <p className={styles['user-signature']}>{item.signature}</p>
                        )}
                        <div className={styles['user-contact']}>
                          {item.maskedPhone && (
                            <span className={styles['contact-item']}>{item.maskedPhone}</span>
                          )}
                          {item.maskedEmail && (
                            <span className={styles['contact-item']}>{item.maskedEmail}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      className={styles['add-btn']}
                      onClick={() => navigate(`/addRequest/${item.id}`)}
                    >
                      添加好友
                    </button>
                  </li>
                ))}
              </ul>
            ) : searchText ? (
              <div className={styles['no-result']}>未找到匹配的用户</div>
            ) : (
              <div className={styles['search-hint']}>请输入搜索内容</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default SearchUserBoard
