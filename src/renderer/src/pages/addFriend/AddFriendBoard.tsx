import React, { useState, useEffect, JSX } from 'react'
import 'modern-normalize/modern-normalize.css'
import styles from './AddFriendBoard.module.css'
import { FriendRequest, User } from '@shared/types'
import LocalImage from '../home/components/LocalImage'
import { useParams, useNavigate } from 'react-router-dom'
import { FaLessThan, FaMars, FaVenus } from 'react-icons/fa6'

const AddFriendBoard: React.FC = () => {
  const { id: userId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [user, setUser] = useState<User | null>(null)
  const [remark, setRemark] = useState<string>('')
  const [message, setMessage] = useState<string>('我是' + (localStorage.getItem('username') || ''))

  useEffect(() => {
    if (userId) {
      window.businessApi.user.selectById(userId).then((apiResult) => {
        if (apiResult.isSuccess && apiResult.data) {
          setUser(apiResult.data)
        }
      })
    } else {
      console.log(`userId为空`)
    }
  }, [userId])

  // 发送好友请求
  const handleSendRequest = async (): Promise<void> => {
    if (!user) return

    try {
      const result = await window.businessApi.friend.requestAddFriend({
        fromId: ((await window.clientData.get('user')) as User).id,
        toId: user.id,
        fromRemark: remark ? remark : user.username,
        statement: message
      } as FriendRequest)

      if (result.isSuccess) {
        alert(`发送成功`)
        navigate(-1) // 发送成功后返回上一页
      } else {
        alert(`发送失败: ${result.msg}`)
      }
    } catch (err) {
      console.error('发送请求错误:', err)
      alert('发送请求失败，请稍后重试')
    }
  }

  // 无用户信息状态
  if (!user) {
    return (
      <div className={styles.emptyContainer}>
        <p>未找到该用户</p>
        <button className={styles.backButton} onClick={() => navigate(-1)}>
          返回上一页
        </button>
      </div>
    )
  }

  // 性别指示器组件
  const GenderIndicator = ({ gender }: { gender: number }): JSX.Element | null => {
    if (gender === 1) return <FaMars className={styles.genderMale} />
    if (gender === 2) return <FaVenus className={styles.genderFemale} />
    return null
  }

  return (
    <div className={styles.container}>
      {/* 头部导航 */}
      <div className={styles.header}>
        <button className={styles.backButton} onClick={() => navigate(-1)} aria-label="返回">
          <FaLessThan className={styles.backIcon} />
        </button>
        <h2 className={styles.pageTitle}>添加好友</h2>
      </div>

      {/* 主体内容 */}
      <div className={styles.body}>
        {/* 用户信息卡片 */}
        <div className={styles.userCard}>
          <LocalImage className={styles['user-avatar']} fileName={user.avatar} />

          <div className={styles['user-info']}>
            <div className={styles['user-name-section']}>
              <span className={styles['user-name']}>{user.username}</span>
              <GenderIndicator gender={user.gender} />
            </div>

            <div className={styles['user-details']}>
              <div className={styles['user-contact']}>
                {user.maskedPhone && (
                  <span className={styles['contact-item']}>{user.maskedPhone}</span>
                )}
                {user.maskedEmail && (
                  <span className={styles['contact-item']}>{user.maskedEmail}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 申请信息输入区 */}
        <div className={styles.formGroup}>
          <label className={styles.label}>验证消息</label>
          <textarea
            className={styles.textarea}
            placeholder="请输入验证消息..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={200}
            rows={4}
          />
          <p className={styles.counter}>{message.length}/200</p>

          <label className={styles.label}>好友备注</label>
          <input
            className={styles.input}
            placeholder="请输入备注名称（选填）"
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            maxLength={30}
          />
        </div>

        {/* 发送按钮 */}
        <button
          className={styles.sendButton}
          onClick={handleSendRequest}
          disabled={!message.trim()}
        >
          发送好友请求
        </button>
      </div>
    </div>
  )
}

export default AddFriendBoard
