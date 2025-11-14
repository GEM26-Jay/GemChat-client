import { useState, useEffect, useRef, JSX } from 'react'
import {
  FaUser,
  FaEnvelope,
  FaPhone,
  FaCalendar,
  FaPen,
  FaSave,
  FaTimes,
  FaEllipsisV,
  FaSpinner,
  FaUserCheck,
  FaUserSlash,
  FaSnowflake,
  FaTransgender
} from 'react-icons/fa'
import styles from './SelfInfoPanel.module.css'
import { User } from '@shared/types'
import LocalImage from '../LocalImage'
import { formatDate } from '@shared/utils'

// 工具函数：转换性别数字为文本
const getGenderText = (gender: number): string => {
  const map = { 0: '未知', 1: '男', 2: '女' }
  return map[gender as keyof typeof map] || '未知'
}

interface StatusInfo {
  text: string
  class: string
  icon: JSX.Element
}

// 工具函数：获取状态样式和文本
const getStatusInfo = (status: number): StatusInfo => {
  const statusMap = [
    { text: '已禁用', class: styles.statusDisabled, icon: <FaUserSlash /> },
    { text: '正常', class: styles.statusNormal, icon: <FaUserCheck /> },
    { text: '已冻结', class: styles.statusFrozen, icon: <FaSnowflake /> }
  ]
  return statusMap[status] || statusMap[0]
}

const UserProfile: React.FC = () => {
  // 状态管理
  const [user, setUser] = useState<User | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [tempUser, setTempUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showActionMenu, setShowActionMenu] = useState(false)
  const actionMenuRef = useRef<HTMLDivElement>(null)

  // 模拟加载用户数据
  useEffect(() => {
    const fetchUser = async (): Promise<void> => {
      try {
        const user = (await window.clientData.get('user')) as User

        // 模拟网络延迟
        setUser(user)
        setTempUser({ ...user })
      } catch (err) {
        setError('加载用户信息失败，请稍后重试')
        console.error('加载失败:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchUser()
  }, [])

  // 点击外部关闭操作菜单
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent): void => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(e.target as Node)) {
        setShowActionMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // 处理输入变化
  const handleInputChange = (field: keyof User, value: string | number): void => {
    if (tempUser) {
      setTempUser((prev) => (prev ? { ...prev, [field]: value } : null))
    }
  }

  // 保存修改
  const handleSave = async (): Promise<void> => {
    if (!tempUser) return

    setLoading(true)
    try {
      // 实际项目中替换为API调用
      await new Promise((resolve) => setTimeout(resolve, 1000))
      setUser(tempUser)
      setEditMode(false)
    } catch (err) {
      setError('保存失败，请稍后重试')
      console.error('保存失败:', err)
    } finally {
      setLoading(false)
    }
  }

  // 取消编辑
  const handleCancel = (): void => {
    if (user) {
      setTempUser({ ...user })
      setEditMode(false)
    }
  }

  // 加载状态
  if (loading && !user) {
    return (
      <div className={styles.loadingContainer}>
        <FaSpinner className={styles.spinner} />
        <p className={styles.loadingText}>加载用户信息中...</p>
      </div>
    )
  }

  // 错误状态
  if (error) {
    return (
      <div className={styles.errorContainer}>
        <p className={styles.errorText}>{error}</p>
        <button className={styles.retryButton} onClick={() => window.location.reload()}>
          重试
        </button>
      </div>
    )
  }

  if (!user || !tempUser) return null
  const statusInfo = getStatusInfo(user.status)

  return (
    <div className={styles.profileContainer}>
      {/* 顶部信息栏 */}
      <div className={styles.header}>
        <h1 className={styles.pageTitle}>个人资料</h1>

        {/* 操作菜单按钮 */}
        <button
          className={styles.actionButton}
          onClick={() => setShowActionMenu(!showActionMenu)}
          aria-label="操作菜单"
        >
          <FaEllipsisV />
        </button>

        {/* 操作菜单 */}
        {showActionMenu && (
          <div className={styles.actionMenu} ref={actionMenuRef}>
            {!editMode ? (
              <button
                className={styles.menuItem}
                onClick={() => {
                  setEditMode(true)
                  setShowActionMenu(false)
                }}
              >
                <FaPen className={styles.menuIcon} />
                编辑资料
              </button>
            ) : (
              <>
                <button className={styles.menuItem} onClick={handleCancel}>
                  <FaTimes className={styles.menuIcon} />
                  取消编辑
                </button>
                <button
                  className={`${styles.menuItem} ${styles.saveItem}`}
                  onClick={handleSave}
                  disabled={loading}
                >
                  {loading ? (
                    <FaSpinner className={styles.spinnerSmall} />
                  ) : (
                    <FaSave className={styles.menuIcon} />
                  )}
                  保存修改
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* 主内容区 */}
      <div className={styles.profileContent}>
        {/* 头像和基本信息 */}
        <div className={styles.profileHeader}>
          <div className={styles.avatarContainer}>
            <LocalImage fileName={user.avatar} className={styles.avatar}></LocalImage>
            {editMode && (
              <div className={styles.avatarOverlay}>
                <span className={styles.avatarEditText}>更换头像</span>
              </div>
            )}
          </div>

          <div className={styles.basicInfo}>
            <div className={styles.nameContainer}>
              {editMode ? (
                <input
                  type="text"
                  value={tempUser.username}
                  onChange={(e) => handleInputChange('username', e.target.value)}
                  className={styles.nameInput}
                  placeholder="请输入用户名"
                />
              ) : (
                <h2 className={styles.username}>{user.username}</h2>
              )}

              <div className={`${styles.statusBadge} ${statusInfo.class}`}>
                {statusInfo.icon}
                <span className={styles.statusText}>{statusInfo.text}</span>
              </div>
            </div>

            {editMode ? (
              <textarea
                value={tempUser.signature}
                onChange={(e) => handleInputChange('signature', e.target.value)}
                className={styles.signatureInput}
                placeholder="请输入个性签名"
                maxLength={100}
              />
            ) : (
              <p className={styles.signature}>{user.signature || '暂无个性签名'}</p>
            )}
          </div>
        </div>

        {/* 详细信息卡片 */}
        <div className={styles.detailsCard}>
          <h3 className={styles.detailsTitle}>个人详情</h3>

          <div className={styles.detailsGrid}>
            {/* 邮箱 */}
            {user.maskedEmail && (
              <div className={styles.detailItem}>
                <div className={styles.detailLabel}>
                  <FaEnvelope className={styles.detailIcon} />
                  <span>邮箱</span>
                </div>
                <div className={styles.detailValue}>{user.maskedEmail}</div>
              </div>
            )}

            {/* 电话 */}
            {user.maskedPhone && (
              <div className={styles.detailItem}>
                <div className={styles.detailLabel}>
                  <FaPhone className={styles.detailIcon} />
                  <span>电话</span>
                </div>
                <div className={styles.detailValue}>{user.maskedPhone}</div>
              </div>
            )}

            {/* 性别 */}
            <div className={styles.detailItem}>
              <div className={styles.detailLabel}>
                <FaTransgender className={styles.detailIcon} />
                <span>性别</span>
              </div>
              <div className={styles.detailValue}>
                {editMode ? (
                  <select
                    value={tempUser.gender}
                    onChange={(e) => handleInputChange('gender', parseInt(e.target.value))}
                    className={styles.detailSelect}
                  >
                    <option value={0}>未知</option>
                    <option value={1}>男</option>
                    <option value={2}>女</option>
                  </select>
                ) : (
                  getGenderText(user.gender)
                )}
              </div>
            </div>

            {/* 生日 */}
            <div className={styles.detailItem}>
              <div className={styles.detailLabel}>
                <FaCalendar className={styles.detailIcon} />
                <span>生日</span>
              </div>
              <div className={styles.detailValue}>
                {editMode ? (
                  <input
                    type="date"
                    value={tempUser.birthdate}
                    onChange={(e) => handleInputChange('birthdate', e.target.value)}
                    className={styles.detailInput}
                  />
                ) : (
                  user.birthdate || '未设置'
                )}
              </div>
            </div>

            {/* 注册时间 */}
            <div className={styles.detailItem}>
              <div className={styles.detailLabel}>
                <FaUser className={styles.detailIcon} />
                <span>注册时间</span>
              </div>
              <div className={styles.detailValue}>{formatDate(user.createdAt)}</div>
            </div>

            {/* 最后更新 */}
            <div className={styles.detailItem}>
              <div className={styles.detailLabel}>
                <FaPen className={styles.detailIcon} />
                <span>最后更新</span>
              </div>
              <div className={styles.detailValue}>{formatDate(user.updatedAt)}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default UserProfile
