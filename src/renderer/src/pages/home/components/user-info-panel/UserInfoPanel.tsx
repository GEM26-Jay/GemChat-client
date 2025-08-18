import { ApiResult, User, UserFriend } from '@shared/types'
import {
  FaComment,
  FaPhone,
  FaVideo,
  FaEdit,
  FaCheck,
  FaSpinner,
  FaEllipsisH
} from 'react-icons/fa'
import styles from './UserInfoPanel.module.css'
import LocalImage from '../LocalImage'
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

const UserInfoPanel: React.FC = () => {
  const { id } = useParams<string>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const navgate = useNavigate()

  // 备注相关状态
  const [remark, setRemark] = useState<string>('')
  const [remarkEdit, setRemarkEdit] = useState<boolean>(false)
  const [tempRemark, setTempRemark] = useState<string>('') // 临时存储编辑中的备注
  const [showEditDiv, setShowEditDiv] = useState<boolean>(false)

  // 用户信息查询
  const {
    data: user,
    isLoading: isUserLoading,
    error: userError
  } = useQuery<User>({
    queryKey: ['user', id],
    queryFn: async () => {
      const result: ApiResult<User> = await window.businessApi.user.selectById(id!)
      if (result.isSuccess && result.data) return result.data
      throw new Error(result.msg || '获取用户信息失败')
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000 // 5分钟缓存
  })

  // 好友关系查询
  const { data: userFriend, isLoading: isFriendLoading } = useQuery<UserFriend>({
    queryKey: ['user_friend', id],
    queryFn: async () => {
      const result: ApiResult<UserFriend> = await window.businessApi.friend.getByid(id!)
      if (result.isSuccess && result.data) return result.data
      throw new Error(result.msg || '获取好友关系失败')
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000
  })

  console.log(JSON.stringify(userFriend))

  // 备注更新Mutation
  const updateRemarkMutation = useMutation({
    mutationFn: async (updatedFriend: UserFriend) => {
      const result: ApiResult<void> =
        await window.businessApi.friend.updateFriendRemark(updatedFriend)
      if (!result.isSuccess) throw new Error(result.msg || '更新备注失败')
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userFriend', id] }) // 刷新好友关系缓存
    },
    onError: (error) => {
      alert(`更新失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  })

  useEffect(() => {
    // 初始化备注
    if (userFriend) {
      setRemark(userFriend.remark || '')
      setTempRemark(userFriend.remark || '')
    }
  }, [userFriend])

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null

    // 点击外部关闭面板的逻辑
    const handleClickOutside = (): void => {
      // 先清除之前的定时器
      if (timer) {
        clearTimeout(timer)
      }
      // 设置新的定时器
      timer = setTimeout(() => {
        setShowEditDiv(false)
      }, 300)
    }

    if (showEditDiv) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    // 正确的清理函数
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      if (timer) {
        clearTimeout(timer)
      }
    }
  }, [showEditDiv]) // 只依赖 showEditDiv
  // 处理备注编辑切换
  const handleEditToggle = (): void => {
    if (remarkEdit) {
      // 取消编辑时恢复原值
      setTempRemark(remark)
    }
    setRemarkEdit(!remarkEdit)
  }

  // 处理备注提交
  const handleRemarkSubmit = async (): Promise<void> => {
    if (!userFriend || tempRemark.trim() === remark.trim()) {
      setRemarkEdit(false)
      return
    }

    // 提交更新
    const apiResult = await window.businessApi.friend.updateFriendRemark({
      ...userFriend,
      remark: tempRemark.trim() || ''
    })
    if (apiResult.isSuccess) {
      setRemark(tempRemark.trim())
      setRemarkEdit(false)
    } else {
      alert(apiResult.msg)
    }
    setRemarkEdit(false)
  }

  // 处理发消息跳转
  const handleSendMessage = (): void => {
    if (user) {
      navigate(`/chat/${user.id}`)
    }
  }

  // 加载状态处理
  if (isUserLoading || isFriendLoading) {
    return (
      <div className={styles['loading-container']}>
        <FaSpinner className={styles['loading-spinner']} />
        <span>加载中...</span>
      </div>
    )
  }

  // 错误状态处理
  if (userError || !user || !userFriend) {
    return (
      <div className={styles['error-container']}>
        <p className={styles['error-message']}>
          {userError instanceof Error ? userError.message : '获取用户信息失败'}
        </p>
        <button
          className={styles['retry-btn']}
          onClick={() => queryClient.invalidateQueries({ queryKey: ['user', id] })}
        >
          重试
        </button>
      </div>
    )
  }

  const handleBlock = async (data: UserFriend): Promise<void> => {
    const newData = { ...data, blockStatus: 1 } as UserFriend
    const apiResult = await window.businessApi.friend.updateFriendBlock(newData)
    if (!apiResult.isSuccess) {
      alert(apiResult.msg)
    } else {
      navgate('/home/friend')
    }
  }

  const handleDelete = async (data: UserFriend): Promise<void> => {
    const newData = { ...data, deleteStatus: 1 } as UserFriend
    const apiResult = await window.businessApi.friend.updateFriendDelete(newData)
    if (!apiResult.isSuccess) {
      alert(apiResult.msg)
    } else {
      navgate('/home/friend')
    }
  }

  // 朋友圈模拟数据
  const momentsPreview = [
    { id: '1', content: '今天天气不错，适合出游～', time: '2小时前' },
    { id: '2', content: '分享一首好听的歌 🎵', time: '昨天' }
  ]

  return (
    <div className={styles['user-info-panel']}>
      {/* 打开编辑面板按钮 - 绝对定位固定 */}
      <FaEllipsisH
        className={styles['header-show-edit-board']}
        onClick={() => setShowEditDiv(true)}
      ></FaEllipsisH>
      {/* 显示编辑面板按钮 - 绝对定位固定 */}
      {showEditDiv && (
        <div className={styles['edit-board']}>
          <button
            className={styles['edit-board-block-btn']}
            onClick={() => handleBlock(userFriend)}
          >
            拉黑
          </button>
          <button
            className={styles['edit-board-delete-btn']}
            onClick={() => handleDelete(userFriend)}
          >
            删除
          </button>
        </div>
      )}
      {/* 头部信息区域 - 固定 */}
      <header className={styles['info-header']}>
        <div className={styles['avatar-container']}>
          <LocalImage
            fileName={user.avatar || 'default-avatar.png'}
            alt={user.username}
            className={styles['avatar']}
          />
        </div>

        <div className={styles['base-info']}>
          <div className={styles['name-container']}>
            <h2 className={styles['username']}>{user.username}</h2>

            <div className={styles['remark-wrapper']}>
              {remarkEdit ? (
                <input
                  type="text"
                  className={styles['remark-input']}
                  value={tempRemark}
                  onChange={(e) => setTempRemark(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleRemarkSubmit()}
                  onBlur={handleRemarkSubmit}
                  autoFocus
                  placeholder="输入备注"
                />
              ) : (
                <span className={styles['remark-text']}>{remark || '未设置备注'}</span>
              )}

              <button
                className={styles['edit-btn']}
                onClick={remarkEdit ? handleRemarkSubmit : handleEditToggle}
                disabled={updateRemarkMutation.isPending}
                aria-label={remarkEdit ? '确认备注' : '编辑备注'}
              >
                {updateRemarkMutation.isPending ? (
                  <FaSpinner className={styles['spinner']} />
                ) : remarkEdit ? (
                  <FaCheck className={styles['icon']} />
                ) : (
                  <FaEdit className={styles['icon']} />
                )}
              </button>
            </div>
          </div>

          {/* 个人签名 */}
          {user.signature && <p className={styles['signature']}>{user.signature}</p>}
        </div>
      </header>

      {/* 主体内容区域 - 可滚动 */}
      <main className={styles['panel-body']}>
        {/* 联系信息卡片 */}
        <section className={styles['contact-card']}>
          <h3 className={styles['section-title']}>联系信息</h3>
          <div className={styles['contact-info']}>
            {user.maskedEmail && (
              <div className={styles['contact-item']}>
                <span className={styles['contact-label']}>邮箱：</span>
                <span className={styles['contact-value']}>{user.maskedEmail}</span>
              </div>
            )}

            {user.maskedPhone && (
              <div className={styles['contact-item']}>
                <span className={styles['contact-label']}>电话：</span>
                <span className={styles['contact-value']}>{user.maskedPhone}</span>
              </div>
            )}

            <div className={styles['contact-item']}>
              <span className={styles['contact-label']}>性别：</span>
              <span className={styles['contact-value']}>
                {!user.gender ? '未知' : user.gender === 1 ? '男' : '女'}
              </span>
            </div>

            {user.birthdate && (
              <div className={styles['contact-item']}>
                <span className={styles['contact-label']}>生日：</span>
                <span className={styles['contact-value']}>{user.birthdate}</span>
              </div>
            )}
          </div>
        </section>

        {/* 朋友圈预览卡片 */}
        <section className={styles['moments-card']}>
          <h3 className={styles['section-title']}>朋友圈动态</h3>
          {momentsPreview.length > 0 ? (
            <div className={styles['moments-list']}>
              {momentsPreview.map((moment) => (
                <div key={moment.id} className={styles['moment-item']}>
                  <p className={styles['moment-content']}>{moment.content}</p>
                  <span className={styles['moment-time']}>{moment.time}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className={styles['no-moments']}>暂无动态</p>
          )}
        </section>
      </main>

      {/* 底部操作区域 - 固定 */}
      <footer className={styles['action-footer']}>
        {userFriend.deleteStatus === 2 ? (
          <div className={styles['action-tip']}>已被对方删除</div>
        ) : userFriend.blockStatus === 2 ? (
          <div className={styles['action-tip']}>已被对方拉黑</div>
        ) : (
          <>
            <button
              className={styles['action-btn']}
              aria-label="发消息"
              onClick={handleSendMessage}
            >
              <FaComment className={styles['btn-icon']} />
            </button>
            <button
              className={styles['action-btn']}
              aria-label="语音通话"
              onClick={handleSendMessage}
            >
              <FaPhone className={styles['btn-icon']} />
            </button>
            <button
              className={styles['action-btn']}
              aria-label="视频通话"
              onClick={handleSendMessage}
            >
              <FaVideo className={styles['btn-icon']} />
            </button>
          </>
        )}
      </footer>
    </div>
  )
}

export default UserInfoPanel
