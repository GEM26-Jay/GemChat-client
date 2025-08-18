import styles from './VerticalSplitPanel.module.css'
import React, { useState, useRef, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { setSplitPanelSize } from '../../store/sliceSplitPanel'
import { RootState } from '@renderer/pages/home/store/store'

interface VerticalSplitPanelProps {
  panelKey: string
  topPanel: React.ReactNode
  bottomPanel: React.ReactNode
  minTopRatio?: number // 上方最小高度比例（0-1，默认0.2）
  maxTopRatio?: number // 上方最大高度比例（0-1，默认0.8）
  initTopRatio?: number // 初始上方高度比例（0-1，默认0.5）
  splitBarHeight?: number // 分割条高度（默认4px）
}

const VerticalSplitPanel: React.FC<VerticalSplitPanelProps> = ({
  panelKey,
  topPanel,
  bottomPanel,
  minTopRatio = 0.2,
  maxTopRatio = 0.8,
  initTopRatio = 0.5,
  splitBarHeight = 4
}) => {
  const dispatch = useDispatch()
  const containerRef = useRef<HTMLDivElement>(null)
  const splitBarRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)

  // 从Redux获取保存的上方比例
  const savedRatio = useSelector(
    (state: RootState) => state['splitPanel'][panelKey] ?? initTopRatio
  )

  // 状态管理上方面板的高度比例
  const [topRatio, setTopRatio] = useState<number>(savedRatio)

  // 窗口大小变化时校准比例
  useEffect(() => {
    const handleResize = (): void => {
      adjustTopRatioByBounds()
    }

    window.addEventListener('resize', handleResize)
    adjustTopRatioByBounds() // 初始化校准

    return () => window.removeEventListener('resize', handleResize)
  })

  // 同步Redux中保存的比例
  useEffect(() => {
    setTopRatio(savedRatio)
  }, [savedRatio])

  /**
   * 确保比例在合理范围内
   */
  const adjustTopRatioByBounds = (): void => {
    if (topRatio < minTopRatio) {
      setTopRatio(minTopRatio)
      dispatch(setSplitPanelSize({ key: panelKey, size: minTopRatio }))
    } else if (topRatio > maxTopRatio) {
      setTopRatio(maxTopRatio)
      dispatch(setSplitPanelSize({ key: panelKey, size: maxTopRatio }))
    }
  }

  /**
   * 开始拖拽分割条
   */
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>): void => {
    e.preventDefault()
    isDragging.current = true
    // 拖拽时添加全局样式优化光标
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
    const containerHeight = containerRect.height

    // 计算鼠标在容器内的相对位置（减去分割条高度的一半优化体验）
    const mouseYInContainer = e.clientY - containerRect.top - splitBarHeight / 2
    const newRatio = Math.max(
      minTopRatio,
      Math.min(maxTopRatio, mouseYInContainer / containerHeight)
    )

    setTopRatio(newRatio)
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
    <div ref={containerRef} className={styles['vertical-split-container']}>
      {/* 上方面板：相对定位承载分割条 */}
      <div className={styles['top-panel']} style={{ height: `${topRatio * 100}%` }}>
        {topPanel}
        {/* 分割条：绝对定位在上方面板底部 */}
        <div
          ref={splitBarRef}
          className={styles['split-bar']}
          style={{ height: `${splitBarHeight}px` }}
          onMouseDown={handleMouseDown}
          aria-label="调整面板高度"
        />
      </div>

      {/* 下方面板：自适应剩余高度 */}
      <div className={styles['bottom-panel']}>{bottomPanel}</div>
    </div>
  )
}

export default VerticalSplitPanel
