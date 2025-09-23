import React, { useEffect, useState } from 'react'
import 'modern-normalize/modern-normalize.css'
import styles from './LoginBoard.module.css'
import electronSVG from '@renderer/assets/electron.svg'
import { ApiResult, LoginFormData, User } from '@shared/types'
import { FaAngleDown, FaAngleUp, FaRegEye, FaRegEyeSlash, FaTimes } from 'react-icons/fa'
import LocalImage from '../home/components/LocalImage'

const LoginBoard: React.FC = () => {
  // 表单状态
  const [loginForm, setLoginForm] = useState<LoginFormData>({
    account: '',
    password: '',
    avatar: '',
    isAgree: false
  })

  const [loginFormList, setLoginFormList] = useState<LoginFormData[]>([])
  const [rememberAccount, setRememberAccount] = useState(true)
  const [rememberPassword, setRememberPassword] = useState(true)
  const [isLogining, setIsLogining] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [formErrors, setFormErrors] = useState({
    account: '',
    password: '',
    agreement: false
  })

  const resetErrors = (): void => {
    setFormErrors({
      account: '',
      password: '',
      agreement: false
    })
  }

  const loadAccountData = async (): Promise<void> => {
    try {
      const data: LoginFormData[] = await window.businessApi.localAccount.getAll()
      window.utilApi.log2main(`用户登录历史账号数据：${JSON.stringify(data)}`)
      const safeData = Array.isArray(data) ? data : []
      setLoginFormList(safeData)
    } catch (error) {
      console.error('加载历史账号失败:', error)
    }
  }

  useEffect(() => {
    loadAccountData()
  }, [])

  const validateForm = (): boolean => {
    const errors = {
      account: !loginForm.account ? '请输入账号（电话/邮箱）' : '',
      password: !loginForm.password ? '请输入密码' : '',
      agreement: !loginForm.isAgree
    }
    setFormErrors(errors)
    return !errors.account && !errors.password && !errors.agreement
  }

  const handleLogin = async (): Promise<void> => {
    setFormErrors({ account: '', password: '', agreement: false })
    if (!validateForm()) return

    setIsLogining(true)
    try {
      const result: ApiResult<string> = await window.businessApi.doUserLogin(
        loginForm.account,
        loginForm.password
      )
      if (result.isSuccess) {
        if (rememberAccount) {
          let data: LoginFormData = {
            ...loginForm
          }
          const user = await window.clientData.get('user')
          if (user) {
            data.avatar = (user as User).avatar
          }
          if (!rememberPassword) {
            data = {
              ...data,
              password: ''
            }
          }
          await window.utilApi.log2main(`用户记住账号：${JSON.stringify(data)}`)
          await window.businessApi.localAccount.addOrUpdata(data)
        }
        window.windowsApi.openMainWindow()
        window.windowsApi.closeLoginWindow()
      } else {
        const showInfo = `登录失败: [错误类型: ${result.errType}, 错误原因: ${result.msg}]`
        alert(showInfo)
        console.error(showInfo)
        setLoginForm((prev) => ({ ...prev, password: '' }))
        setFormErrors((prev) => ({ ...prev, password: result.msg ? result.msg : '未知错误' }))
      }
    } catch (error) {
      console.error('登录失败:', error)
      alert('未知错误')
    } finally {
      setIsLogining(false)
    }
  }

  const handleAccountSelect = (account: string): void => {
    resetErrors()
    const selectedAccount = loginFormList.find((item) => item.account === account)
    if (selectedAccount) {
      setLoginForm({
        account: selectedAccount.account,
        password: selectedAccount.password,
        avatar: selectedAccount.avatar || '',
        isAgree: selectedAccount.isAgree
      })
    }
    setShowDropdown(false)
  }

  const handleAccountDelete = (account: string): void => {
    resetErrors()
    window.businessApi.localAccount.delete(account)
    setLoginFormList((prevList) => prevList.filter((item) => item.account !== account))
  }

  const handleOpenRegister = (): void => {
    resetErrors()
    window.windowsApi.openRegisterWindow().catch(console.error)
  }

  return (
    <div className={styles.loginContainer}>
      <div className={styles.header}>
        <LocalImage
          fileName={loginForm.avatar}
          className={styles.userAvatar}
          alt="avatar"
        ></LocalImage>
      </div>

      <div className={styles.formContainer}>
        <div className={styles.accountDiv}>
          <div
            className={`${styles.accountField} ${
              formErrors.account ? styles['inputField-error'] : ''
            }`}
          >
            <input
              type="text"
              value={loginForm.account}
              onChange={(e) => {
                setLoginForm({ ...loginForm, account: e.target.value })
                setFormErrors({ ...formErrors, account: '' })
              }}
              placeholder="账号（电话/邮箱）"
            />
            <button
              className={styles.dropdownToggle}
              onClick={() => setShowDropdown(!showDropdown)}
              type="button"
            >
              {showDropdown ? <FaAngleUp /> : <FaAngleDown />}
            </button>
            {showDropdown && loginFormList.length > 0 && (
              <div className={styles.accountMenu}>
                {loginFormList.map((item) => (
                  <div
                    key={item.account}
                    className={styles.accountItem}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleAccountSelect(item.account)
                    }}
                  >
                    <LocalImage
                      fileName={item.avatar || electronSVG}
                      className={styles.accountItemAvatar}
                      alt="avatar"
                    ></LocalImage>
                    <span>{item.account}</span>
                    <button
                      className={styles.accountItemDeleteBtn}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleAccountDelete(item.account)
                      }}
                    >
                      <FaTimes></FaTimes>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          {formErrors.account && <div className={styles.errorText}>{formErrors.account}</div>}
        </div>

        <div className={styles.passwordDiv}>
          <div
            className={`${styles.passwordField} ${
              formErrors.password ? styles['inputField-error'] : ''
            }`}
          >
            <input
              type={showPassword ? 'text' : 'password'}
              value={loginForm.password}
              onChange={(e) => {
                setLoginForm({ ...loginForm, password: e.target.value })
                setFormErrors({ ...formErrors, password: '' })
              }}
              placeholder="密码"
            />
            <button
              className={styles.passwordToggle}
              onClick={() => setShowPassword(!showPassword)}
              type="button"
            >
              {showPassword ? <FaRegEye /> : <FaRegEyeSlash />}
            </button>
          </div>
          {formErrors.password && <div className={styles.errorText}>{formErrors.password}</div>}
        </div>

        <div className={styles.rememberOptions}>
          <label className={styles.rememberOption}>
            <input
              type="checkbox"
              checked={rememberAccount}
              onChange={(e) => setRememberAccount(e.target.checked)}
            />
            <span>记住账号</span>
          </label>
          <label className={styles.rememberOption}>
            <input
              type="checkbox"
              checked={rememberPassword}
              onChange={(e) => setRememberPassword(e.target.checked)}
            />
            <span>记住密码</span>
          </label>
        </div>
      </div>

      <div className={styles.actionContainer}>
        <div
          className={`${styles.agreement} ${
            formErrors.agreement ? styles['agreementArea-error'] : ''
          }`}
        >
          <input
            type="checkbox"
            checked={loginForm.isAgree}
            onChange={(e) => {
              setLoginForm({
                ...loginForm,
                isAgree: e.target.checked
              })
              setFormErrors({ ...formErrors, agreement: false })
            }}
          />
          <span>我已阅读并同意服务协议和隐私政策</span>
        </div>
        <button className={styles.loginButton} onClick={handleLogin} disabled={isLogining}>
          {isLogining ? '登录中...' : '登录'}
        </button>
      </div>

      <div className={styles.footerLinks}>
        <button className={styles.footerLink} onClick={handleOpenRegister}>
          注册账号
        </button>
        <span className={styles.linkDivider}>|</span>
        <button className={styles.footerLink}>忘记密码</button>
      </div>
    </div>
  )
}

export default LoginBoard
