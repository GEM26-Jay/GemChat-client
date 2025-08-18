import React, { useState, useRef, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { setSplitPanelSize } from '../../store/sliceSplitPanel'
import styles from './HorizontalSplitPanel.module.css'
import { RootState } from '@renderer/pages/home/store/store'

interface HorizontalSplitPanelProps {
  panelKey: string // 用于Redux存储的唯一键
  leftPanel: React.ReactNode // 左侧面板内容
  rightPanel: React.ReactNode // 右侧面板内容
  minLeftRatio?: number // 左侧最小宽度比例（0-1，默认0.2）
  maxLeftRatio?: number // 左侧最大宽度比例（0-1，默认0.8）
  initLeftRatio?: number // 初始左侧宽度比例（0-1，默认0.5）
  splitBarWidth?: number // 分割条宽度（默认4px）
}

const HorizontalSplitPanel: React.FC<HorizontalSplitPanelProps> = ({
  panelKey,
  leftPanel,
  rightPanel,
  minLeftRatio = 0.2,
  maxLeftRatio = 0.8,
  initLeftRatio = 0.5,
  splitBarWidth = 4
}) => {
  const dispatch = useDispatch()
  const containerRef = useRef<HTMLDivElement>(null)
  const splitBarRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)

  // 从Redux获取保存的左侧比例
  const savedRatio = useSelector(
    (state: RootState) => state['splitPanel'][panelKey] ?? initLeftRatio
  )

  // 状态管理左侧面板的宽度比例
  const [leftRatio, setLeftRatio] = useState<number>(savedRatio)

  // 窗口大小变化时校准比例
  useEffect(() => {
    const handleResize = (): void => {
      adjustLeftRatioByBounds()
    }

    window.addEventListener('resize', handleResize)
    adjustLeftRatioByBounds() // 初始化校准

    return () => window.removeEventListener('resize', handleResize)
  })

  // 同步Redux保存的比例
  useEffect(() => {
    setLeftRatio(savedRatio)
  }, [savedRatio])

  /**
   * 确保比例在合理范围内
   */
  const adjustLeftRatioByBounds = (): void => {
    if (leftRatio < minLeftRatio) {
      setLeftRatio(minLeftRatio)
      dispatch(setSplitPanelSize({ key: panelKey, size: minLeftRatio }))
    } else if (leftRatio > maxLeftRatio) {
      setLeftRatio(maxLeftRatio)
      dispatch(setSplitPanelSize({ key: panelKey, size: maxLeftRatio }))
    }
  }

  /**
   * 开始拖拽
   */
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>): void => {
    e.preventDefault()
    isDragging.current = true
    // 拖拽时添加全局样式，优化光标显示
    document.body.classList.add(styles['dragging'])
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  /**
   * 拖拽中更新比例
   */
  const handleMouseMove = (e: MouseEvent): void => {
    if (!isDragging.current || !containerRef.current) return

    const containerRect = containerRef.current.getBoundingClientRect()
    const containerWidth = containerRect.width

    // 计算鼠标在容器内的相对位置（减去分割条宽度的一半，优化拖拽体验）
    const mouseXInContainer = e.clientX - containerRect.left - splitBarWidth / 2
    const newRatio = Math.max(
      minLeftRatio,
      Math.min(maxLeftRatio, mouseXInContainer / containerWidth)
    )

    setLeftRatio(newRatio)
    dispatch(setSplitPanelSize({ key: panelKey, size: newRatio }))
  }

  /**
   * 结束拖拽
   */
  const handleMouseUp = (): void => {
    isDragging.current = false
    document.body.classList.remove(styles['dragging'])
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
  }

  return (
    <div ref={containerRef} className={styles['resizable-split-panel']}>
      {/* 左侧面板：相对定位，为分割条提供容器 */}
      <div className={styles['left-panel']} style={{ width: `${leftRatio * 100}%` }}>
        {leftPanel}
        {/* 分割条：绝对定位在左侧面板右侧 */}
        <div
          ref={splitBarRef}
          className={styles['split-bar']}
          style={{ width: `${splitBarWidth}px` }}
          onMouseDown={handleMouseDown}
          aria-label="调整面板宽度"
        />
      </div>

      {/* 右侧面板：自动填充剩余宽度 */}
      <div className={styles['right-panel']}>{rightPanel}</div>
    </div>
  )
}

export default HorizontalSplitPanel
