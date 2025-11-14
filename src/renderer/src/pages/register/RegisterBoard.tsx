import React, { useState } from 'react'
import 'modern-normalize/modern-normalize.css'
import styles from './RegisterBoard.module.css'
import electronSVG from '@renderer/assets/electron.svg'
import { ApiResult, RegisterData, UniversalFile } from 'src/shared/types'
import { FaCloudUploadAlt } from 'react-icons/fa'

const RegisterPage: React.FC = () => {
  // 表单状态管理
  const [formData, setFormData] = useState<RegisterData>({
    username: '',
    avatar: '',
    password: '',
    confirmPassword: '',
    email: '',
    phone: '',
    signature: '',
    gender: '0',
    birthdate: ''
  })

  const [avatar, setAvatar] = useState<UniversalFile | null>()

  // 错误提示状态
  const [errors, setErrors] = useState<Record<string, string>>({})
  // 提交状态
  const [isSubmitting, setIsSubmitting] = useState(false)

  // 处理表单输入变化
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ): void => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))

    // 清除对应字段的错误提示
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }))
    }
  }

  // 表单验证逻辑
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    // 用户名验证
    if (!formData.username.trim()) {
      newErrors.username = '用户名不能为空'
    } else if (formData.username.length < 3 || formData.username.length > 20) {
      newErrors.username = '用户名长度需在3-20字符之间'
    }

    // 用户头像是否上传
    if (avatar == null) {
      alert('用户头像不能为空')
      return false
    }

    // 密码验证
    if (!formData.password) {
      newErrors.password = '密码不能为空'
    } else if (formData.password.length < 6) {
      newErrors.password = '密码长度不能少于6位'
    }

    // 确认密码验证
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = '两次输入的密码不一致'
    }

    // 邮箱/手机二选一验证
    if (!formData.email.trim() && !formData.phone.trim()) {
      newErrors.contact = '邮箱和手机号至少填写一项'
    } else {
      // 邮箱格式验证
      if (formData.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        newErrors.email = '请输入有效的邮箱地址'
      }
      // 手机号格式验证
      if (formData.phone.trim() && !/^1[3-9]\d{9}$/.test(formData.phone)) {
        newErrors.phone = '请输入有效的手机号码'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // 处理表单提交
  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!validateForm()) return

    setIsSubmitting(true)
    try {
      let data = {
        ...formData
      }
      if (avatar) {
        const uploadResult = await window.fileManager.uploadAvatar(avatar)
        if (uploadResult.isSuccess && uploadResult.data) {
          const newFile: UniversalFile = uploadResult.data
          data = {
            ...data,
            avatar: newFile.fileName
          }
        } else {
          alert(uploadResult.msg)
          return
        }
      }
      // 直接使用 await 处理异步请求，避免 then/catch 混用
      console.log(`发起注册账号请求，注册数据：${JSON.stringify(data)}`)
      const apiResult: ApiResult<void> = await window.businessApi.doUserRegister({
        ...data,
        confirmPassword: undefined
      })
      if (apiResult.isSuccess) {
        // 注册成功处理
        alert('注册成功！即将自动关闭注册页...') // 提示用户即将自动关闭
        setTimeout(() => {
          window.windowsApi.closeRegisterWindow?.() // 2秒后自动关闭
        }, 1000)
      } else {
        alert(`注册失败: [失败类型: ${apiResult.errType}, 失败原因: ${apiResult.msg}]`)
        setIsSubmitting(false)
      }
    } catch (error) {
      // 统一错误处理
      console.error('注册失败:', error)

      // 区分已知错误和未知错误
      const errorMessage = error instanceof Error ? error.message : '注册失败，请稍后重试'

      alert(`注册失败: ${errorMessage}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  // 处理头像上传
  const handleSetAvatar = async (): Promise<void> => {
    const result: ApiResult<UniversalFile[]> = await window.fileManager.openFileDialog({
      'image/*': 'Base64'
    })
    if (result.isSuccess && result.data) {
      const dataList: UniversalFile[] = result.data
      if (dataList.length > 1) {
        alert('只能选择一个文件')
      } else if (dataList.length === 1) {
        const data: UniversalFile = dataList[0]
        if (!data.mimeType.match('image/*')) {
          alert('请选择图片文件')
        } else {
          setAvatar(data)
        }
      }
    } else {
      alert(`头像上传失败：${result.msg}`)
    }
  }

  return (
    <div className={styles.registerContainer}>
      {/* 头部Logo区域 */}
      <div className={styles.header}>
        <div className={styles[`avatar-container`]} onClick={handleSetAvatar}>
          {avatar ? (
            <img
              src={
                avatar.mimeType && avatar.content
                  ? `data:${avatar.mimeType};base64,${avatar.content}`
                  : electronSVG // 头像数据异常时显示默认图标
              }
              alt="用户头像"
              className={styles.avatar}
            />
          ) : (
            <div className={styles.avatar}>
              <FaCloudUploadAlt className={styles.avatarIcon} />
            </div>
          )}
        </div>
        <h1 className={styles.title}>注册账号</h1>
        <p className={styles.subtitle}>填写以下信息完成注册</p>
      </div>

      {/* 注册表单 */}
      <form onSubmit={handleSubmit} className={styles.registerForm}>
        {/* 用户名输入 */}
        <div className={styles.formGroup}>
          <label htmlFor="username" className={styles.label}>
            用户名 <span className={styles.required}>*</span>
          </label>
          <input
            type="text"
            id="username"
            name="username"
            value={formData.username}
            onChange={handleChange}
            className={`${styles.input} ${errors.username ? styles.inputError : ''}`}
            placeholder="请输入用户名（3-20字符）"
          />
          {errors.username && <span className={styles.errorText}>{errors.username}</span>}
        </div>

        {/* 密码输入 */}
        <div className={styles.formGroup}>
          <label htmlFor="password" className={styles.label}>
            密码 <span className={styles.required}>*</span>
          </label>
          <input
            type="password"
            id="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            className={`${styles.input} ${errors.password ? styles.inputError : ''}`}
            placeholder="请输入密码（至少6位）"
          />
          {errors.password && <span className={styles.errorText}>{errors.password}</span>}
        </div>

        {/* 确认密码 */}
        <div className={styles.formGroup}>
          <label htmlFor="confirmPassword" className={styles.label}>
            确认密码 <span className={styles.required}>*</span>
          </label>
          <input
            type="password"
            id="confirmPassword"
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleChange}
            className={`${styles.input} ${errors.confirmPassword ? styles.inputError : ''}`}
            placeholder="请再次输入密码"
          />
          {errors.confirmPassword && (
            <span className={styles.errorText}>{errors.confirmPassword}</span>
          )}
        </div>

        {/* 联系方式（邮箱/手机二选一） */}
        <div className={styles.contactGroup}>
          <div className={styles.labelWithHint}>
            <label className={styles.label}>
              联系方式 <span className={styles.required}>*</span>
            </label>
            <span className={styles.hintText}>邮箱和手机号至少填写一项</span>
          </div>

          {errors.contact && <span className={styles.errorText}>{errors.contact}</span>}

          <div className={styles.twoColumn}>
            {/* 邮箱输入 */}
            <div className={styles.formGroup}>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className={`${styles.input} ${errors.email ? styles.inputError : ''}`}
                placeholder="邮箱地址"
              />
              {errors.email && <span className={styles.errorText}>{errors.email}</span>}
            </div>

            {/* 手机号输入 */}
            <div className={styles.formGroup}>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className={`${styles.input} ${errors.phone ? styles.inputError : ''}`}
                placeholder="手机号码"
              />
              {errors.phone && <span className={styles.errorText}>{errors.phone}</span>}
            </div>
          </div>
        </div>

        {/* 性别选择 */}
        <div className={styles.formGroup}>
          <label htmlFor="gender" className={styles.label}>
            性别
          </label>
          <select
            id="gender"
            name="gender"
            value={formData.gender}
            onChange={handleChange}
            className={styles.select}
          >
            <option value="0">保密</option>
            <option value="1">男</option>
            <option value="2">女</option>
          </select>
        </div>

        {/* 出生日期 */}
        <div className={styles.formGroup}>
          <label htmlFor="birthdate" className={styles.label}>
            出生日期
          </label>
          <input
            type="date"
            id="birthdate"
            name="birthdate"
            value={formData.birthdate}
            onChange={handleChange}
            className={styles.input}
          />
        </div>

        {/* 个性签名 */}
        <div className={styles.formGroup}>
          <label htmlFor="signature" className={styles.label}>
            个性签名
          </label>
          <textarea
            id="signature"
            name="signature"
            value={formData.signature}
            onChange={handleChange}
            className={styles.textarea}
            placeholder="请输入个性签名（可选）"
            maxLength={100}
            rows={3}
          />
          <span className={styles.counter}>{formData.signature.length}/100</span>
        </div>

        {/* 注册按钮 */}
        <button type="submit" className={styles.submitButton} disabled={isSubmitting}>
          {isSubmitting ? '注册中...' : '完成注册'}
        </button>
      </form>
    </div>
  )
}

export default RegisterPage
