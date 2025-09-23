import { FaQuestionCircle } from 'react-icons/fa'
import styles from './SettingPanel.module.css'
import {
  FaUser,
  FaMoon,
  FaBell,
  FaLock,
  FaChevronRight,
  FaSun,
  FaPalette,
  FaVolumeXmark,
  FaEnvelope,
  FaMobileScreen,
  FaToggleOn,
  FaToggleOff
} from 'react-icons/fa6'

const SettingPanel: React.FC = () => {
  return (
    <div className={styles['setting-panel-wrapper']}>
      <div className={styles['settings-header']}>
        <h1>设置</h1>
        <p>自定义你的应用体验</p>
      </div>

      {/* 账户设置 */}
      <div className={styles['settings-section']}>
        <h2 className={styles['section-title']}>账户</h2>
        <div className={styles['setting-item']}>
          <div className={styles['setting-icon']}>
            <FaUser size={20} />
          </div>
          <div className={styles['setting-info']}>
            <h3>个人资料</h3>
            <p>编辑你的姓名、头像和个人信息</p>
          </div>
          <FaChevronRight size={20} className={styles['setting-arrow']} />
        </div>

        <div className={styles['setting-item']}>
          <div className={styles['setting-icon']}>
            <FaLock size={20} />
          </div>
          <div className={styles['setting-info']}>
            <h3>密码与安全</h3>
            <p>更改密码和安全设置</p>
          </div>
          <FaChevronRight size={20} className={styles['setting-arrow']} />
        </div>
      </div>

      {/* 外观设置 */}
      <div className={styles['settings-section']}>
        <h2 className={styles['section-title']}>外观</h2>
        <div className={styles['setting-item']}>
          <div className={styles['setting-icon']}>
            <FaPalette size={20} />
          </div>
          <div className={styles['setting-info']}>
            <h3>主题模式</h3>
            <p>切换应用显示主题</p>
          </div>
          <div className={styles['setting-toggle-group']}>
            <button className={styles['theme-btn']}>
              <FaSun size={16} />
            </button>
            <button className={styles['theme-btn active']}>
              <FaMoon size={16} />
            </button>
            <button className={styles['theme-btn']}>
              <FaMoon size={16} style={{ opacity: 0.7 }} />
            </button>
          </div>
        </div>

        <div className={styles['setting-item']}>
          <div className={styles['setting-icon']}>
            <FaToggleOff size={20} />
          </div>
          <div className={styles['setting-info']}>
            <h3>深色模式</h3>
            <p>启用或禁用深色显示样式</p>
          </div>
          <div className={styles['setting-toggle']}>
            <FaToggleOn size={24} />
          </div>
        </div>
      </div>

      {/* 通知设置 */}
      <div className={styles['settings-section']}>
        <h2 className={styles['section-title']}>通知</h2>
        <div className={styles['setting-item']}>
          <div className={styles['setting-icon']}>
            <FaBell size={20} />
          </div>
          <div className={styles['setting-info']}>
            <h3>通知提醒</h3>
            <p>接收新消息和更新通知</p>
          </div>
          <div className={styles['setting-toggle']}>
            <FaToggleOn size={24} />
          </div>
        </div>

        <div className={styles['setting-item']}>
          <div className={styles['setting-icon']}>
            <FaEnvelope size={20} />
          </div>
          <div className={styles['setting-info']}>
            <h3>邮件通知</h3>
            <p>通过邮件接收重要通知</p>
          </div>
          <div className={styles['setting-toggle']}>
            <FaToggleOff size={24} />
          </div>
        </div>

        <div className={styles['setting-item']}>
          <div className={styles['setting-icon']}>
            <FaMobileScreen size={20} />
          </div>
          <div className={styles['setting-info']}>
            <h3>推送通知</h3>
            <p>在移动设备上接收推送</p>
          </div>
          <div className={styles['setting-toggle']}>
            <FaToggleOn size={24} />
          </div>
        </div>
      </div>

      {/* 隐私设置 */}
      <div className={styles['settings-section']}>
        <h2 className={styles['section-title']}>隐私</h2>
        <div className={styles['setting-item']}>
          <div className={styles['setting-icon']}>
            <FaLock size={20} />
          </div>
          <div className={styles['setting-info']}>
            <h3>数据共享</h3>
            <p>管理你的数据共享偏好</p>
          </div>
          <div className={styles['setting-toggle']}>
            <FaToggleOff size={24} />
          </div>
        </div>

        <div className={styles['setting-item']}>
          <div className={styles['setting-icon']}>
            <FaVolumeXmark size={20} />
          </div>
          <div className={styles['setting-info']}>
            <h3>隐身模式</h3>
            <p>隐藏你的在线状态</p>
          </div>
          <div className={styles['setting-toggle']}>
            <FaToggleOff size={24} />
          </div>
        </div>
      </div>

      {/* 关于 */}
      <div className={styles['settings-section']}>
        <h2 className={styles['section-title']}>关于</h2>
        <div className={styles['setting-item']}>
          <div className={styles['setting-icon']}>
            <FaQuestionCircle size={20} />
          </div>
          <div className={styles['setting-info']}>
            <h3>帮助与支持</h3>
            <p>获取使用帮助和联系支持</p>
          </div>
          <FaChevronRight size={20} className={styles['setting-arrow']} />
        </div>
      </div>

      {/* 底部按钮 */}
      <div className={styles['settings-footer']}>
        <button className={styles['logout-btn']}>退出登录</button>
      </div>
    </div>
  )
}

export default SettingPanel
