import React, { useState, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useCanvasStore } from '../../stores/canvasStore'
import { addImageToCanvas, getFabricCanvas } from '../Canvas/CanvasView'
import GuideLinesPanel from '../Panel/GuideLinesPanel'
import LayersPanel from '../Panel/LayersPanel'
import RatioPanel from '../Panel/RatioPanel'
import ExportPanel from '../Panel/ExportPanel'
import TransparencyPanel from '../Panel/TransparencyPanel'

type PanelType = 'guides' | 'layers' | 'ratio' | 'export' | 'transparency' | null

const Toolbar: React.FC = () => {
  const { t } = useTranslation()
  const [activePanel, setActivePanel] = useState<PanelType>(null)
  const [isExpanded, setIsExpanded] = useState(false)
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(true)

  useEffect(() => {
    const syncAlwaysOnTop = async () => {
      try {
        const value = await window.electronAPI.getAlwaysOnTop()
        setIsAlwaysOnTop(value)
      } catch (error) {
        console.error('获取置顶状态失败:', error)
      }
    }

    syncAlwaysOnTop()
  }, [])

  const {
    isPassthrough,
    setPassthrough,
    showToast,
    addImage,
    selectedImageId,
    moveImageToTop,
    moveImageToBottom,
    resizeBehavior,
    canvasWidth,
    canvasHeight
  } = useCanvasStore()

  const toolbarScale = Math.min(Math.max(Math.min(canvasWidth / 1270, canvasHeight / 960), 0.72), 1.1)

  useEffect(() => {
    document.documentElement.style.setProperty('--toolbar-scale', String(toolbarScale))

    return () => {
      document.documentElement.style.setProperty('--toolbar-scale', '1')
    }
  }, [toolbarScale])

  const togglePanel = useCallback(
    (panel: PanelType) => {
      setActivePanel((prev) => (prev === panel ? null : panel))
      if (!isExpanded) setIsExpanded(true)
    },
    [isExpanded]
  )

  // 导入图片
  const handleImport = useCallback(async () => {
    try {
      const files = await window.electronAPI.openFileDialog()
      if (!files.length) return

      for (const file of files) {
        const id = await addImageToCanvas(file.dataUrl, file.name)
        if (id) {
          addImage({
            id,
            name: file.name,
            fabricObjectIndex: -1,
            visible: true,
            locked: false
          })
        }
      }

      if (files.length === 1) {
        showToast(t('status.imageAdded'))
      } else {
        showToast(t('status.imagesAdded', { count: files.length }))
      }
    } catch (err) {
      console.error('导入失败:', err)
    }
  }, [addImage, showToast, t])

  // 切换鼠标穿透
  const handlePassthrough = useCallback(() => {
    const next = !isPassthrough
    setPassthrough(next)
    window.electronAPI.setIgnoreMouseEvents(next, { forward: true })
    showToast(next ? t('status.passthroughOn') : t('status.passthroughOff'))
  }, [isPassthrough, setPassthrough, showToast, t])

  // 切换始终置顶
  const handleAlwaysOnTop = useCallback(() => {
    const next = !isAlwaysOnTop
    setIsAlwaysOnTop(next)
    window.electronAPI.setAlwaysOnTop(next)
    showToast(next ? t('status.alwaysOnTopOn') : t('status.alwaysOnTopOff'))
  }, [isAlwaysOnTop, showToast, t])

  const applyLayerOrderToCanvas = useCallback((orderedIdsBottomToTop: string[]) => {
    const canvas = getFabricCanvas()
    if (!canvas) return

    orderedIdsBottomToTop.forEach((id, index) => {
      const obj = canvas.getObjects().find((o: any) => o.data?.id === id)
      if (obj) {
        canvas.moveObjectTo(obj, index)
      }
    })

    canvas.renderAll()
  }, [])

  const handleMoveLayerToTop = useCallback(() => {
    if (!selectedImageId) return

    moveImageToTop(selectedImageId)
    const updated = useCanvasStore.getState().images
    applyLayerOrderToCanvas(updated.map((img) => img.id))
    showToast(t('status.layerToTop'))
  }, [selectedImageId, moveImageToTop, applyLayerOrderToCanvas, showToast, t])

  const handleMoveLayerToBottom = useCallback(() => {
    if (!selectedImageId) return

    moveImageToBottom(selectedImageId)
    const updated = useCanvasStore.getState().images
    applyLayerOrderToCanvas(updated.map((img) => img.id))
    showToast(t('status.layerToBottom'))
  }, [selectedImageId, moveImageToBottom, applyLayerOrderToCanvas, showToast, t])

  return (
    <>
      {/* 工具栏容器 */}
      <div
        className={`toolbar ${isExpanded ? 'toolbar--expanded' : ''}`}
        style={{ 
          '--toolbar-scale': toolbarScale,
          pointerEvents: 'auto'
        } as React.CSSProperties}
        onMouseEnter={() => {
          setIsExpanded(true)
          if (isPassthrough) {
            window.electronAPI.setIgnoreMouseEvents(false)
          }
        }}
        onMouseLeave={() => {
          if (!activePanel) setIsExpanded(false)
          if (isPassthrough) {
            window.electronAPI.setIgnoreMouseEvents(true, { forward: true })
          }
        }}
      >
        {/* 折叠状态下的小按钮 */}
        {!isExpanded && (
          <div className="toolbar__trigger">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
            </svg>
          </div>
        )}

        {/* 展开后的按钮组 */}
        {isExpanded && (
          <div className="toolbar__buttons">
            <ToolButton
              icon={<ImportIcon />}
              label={t('toolbar.import')}
              onClick={handleImport}
            />
            <ToolButton
              icon={<ExportIcon />}
              label={t('toolbar.export')}
              active={activePanel === 'export'}
              onClick={() => togglePanel('export')}
            />

            <div className="toolbar__divider" />

            <ToolButton
              icon={<RatioIcon />}
              label={t('toolbar.ratio')}
              active={activePanel === 'ratio'}
              onClick={() => togglePanel('ratio')}
            />
            <ResizeModeBadge mode={resizeBehavior} />
            <ToolButton
              icon={<GuideIcon />}
              label={t('toolbar.guides')}
              active={activePanel === 'guides'}
              onClick={() => togglePanel('guides')}
            />
            <ToolButton
              icon={<LayerIcon />}
              label={t('toolbar.layers')}
              active={activePanel === 'layers'}
              onClick={() => togglePanel('layers')}
            />

            <div className="toolbar__divider" />

            <ToolButton
              icon={<TransparencyIcon />}
              label={t('toolbar.transparency')}
              active={activePanel === 'transparency'}
              onClick={() => togglePanel('transparency')}
            />
            <ToolButton
              icon={<PassthroughIcon />}
              label={t('toolbar.passthrough')}
              active={isPassthrough}
              onClick={handlePassthrough}
            />
            <ToolButton
              icon={<PinIcon />}
              label={t('toolbar.alwaysOnTop')}
              active={isAlwaysOnTop}
              onClick={handleAlwaysOnTop}
            />

            <div className="toolbar__divider" />

            <ToolButton
              icon={<LayerTopIcon />}
              label={t('toolbar.layerTop')}
              disabled={!selectedImageId}
              onClick={handleMoveLayerToTop}
            />
            <ToolButton
              icon={<LayerBottomIcon />}
              label={t('toolbar.layerBottom')}
              disabled={!selectedImageId}
              onClick={handleMoveLayerToBottom}
            />

            {/* 窗口控制 */}
            <div className="toolbar__divider" />
            <ToolButton
              icon={<MinimizeIcon />}
              label=""
              onClick={() => window.electronAPI.minimize()}
              className="toolbar__winbtn"
            />
            <ToolButton
              icon={<MaximizeIcon />}
              label=""
              onClick={() => window.electronAPI.maximize()}
              className="toolbar__winbtn"
            />
            <ToolButton
              icon={<CloseIcon />}
              label=""
              onClick={() => window.electronAPI.close()}
              className="toolbar__winbtn toolbar__winbtn--close"
            />
          </div>
        )}
      </div>

      {/* 面板区域 */}
      {activePanel && (
        <div className="panel-overlay">
          <div className="panel">
            <button className="panel__close" onClick={() => { setActivePanel(null); setIsExpanded(false) }}>
              ✕
            </button>
            {activePanel === 'guides' && <GuideLinesPanel />}
            {activePanel === 'layers' && <LayersPanel />}
            {activePanel === 'ratio' && <RatioPanel />}
            {activePanel === 'export' && <ExportPanel />}
            {activePanel === 'transparency' && <TransparencyPanel />}
          </div>
        </div>
      )}
    </>
  )
}

// 工具按钮组件
interface ToolButtonProps {
  icon: React.ReactNode
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  className?: string
}

interface ResizeModeBadgeProps {
  mode: 'scale' | 'edge-anchor'
}

const ResizeModeBadge: React.FC<ResizeModeBadgeProps> = ({ mode }) => {
  const { t } = useTranslation()
  const isScale = mode === 'scale'

  return (
    <span
      className={`toolbar__mode-badge ${isScale ? 'toolbar__mode-badge--scale' : 'toolbar__mode-badge--edge'}`}
      title={t('toolbar.resizeMode')}
    >
      {isScale ? t('toolbar.resizeScaleShort') : t('toolbar.resizeEdgeShort')}
    </span>
  )
}

const ToolButton: React.FC<ToolButtonProps> = ({
  icon, label, active, disabled, onClick, className
}) => (
  <button
    className={`toolbar__btn ${active ? 'toolbar__btn--active' : ''} ${disabled ? 'toolbar__btn--disabled' : ''} ${className || ''}`}
    onClick={onClick}
    disabled={disabled}
    title={label}
  >
    <span className="toolbar__btn-icon">{icon}</span>
    {label && <span className="toolbar__btn-label">{label}</span>}
  </button>
)

// ======= SVG 图标 =======
const ImportIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
)

const ExportIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
)

const RatioIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <rect x="2" y="3" width="20" height="18" rx="2" />
    <line x1="9" y1="3" x2="9" y2="21" />
    <line x1="15" y1="3" x2="15" y2="21" />
  </svg>
)

const GuideIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="3" y1="12" x2="21" y2="12" strokeDasharray="4 2" />
    <line x1="12" y1="3" x2="12" y2="21" strokeDasharray="4 2" />
  </svg>
)

const LayerIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <polygon points="12 2 2 7 12 12 22 7 12 2" />
    <polyline points="2 17 12 22 22 17" />
    <polyline points="2 12 12 17 22 12" />
  </svg>
)

const TransparencyIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 2a10 10 0 010 20" fill="currentColor" opacity="0.3" />
  </svg>
)

const PassthroughIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M15 15l-2 5L9 9l11 4-5 2z" />
    <path d="M2 2l20 20" strokeDasharray="3 3" />
  </svg>
)

const PinIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 3l6 6" />
    <path d="M9 21l3-6" />
    <path d="M3 9l6 6" />
    <path d="M14 4l6 6-7 3-2 2-2-2-3-7z" />
  </svg>
)

const LayerTopIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="12 5 8 9 16 9 12 5" />
    <rect x="5" y="10" width="14" height="9" rx="2" />
  </svg>
)

const LayerBottomIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="5" width="14" height="9" rx="2" />
    <polyline points="12 19 8 15 16 15 12 19" />
  </svg>
)

const MinimizeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
)

const MaximizeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="4" y="4" width="16" height="16" rx="1" />
  </svg>
)

const CloseIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

export default Toolbar
