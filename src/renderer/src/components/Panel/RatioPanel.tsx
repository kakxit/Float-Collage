import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useCanvasStore } from '../../stores/canvasStore'

// 预设比例
const presets = [
  { label: '1:1', ratio: 1, w: 1080, h: 1080 },
  { label: '16:9', ratio: 16 / 9, w: 1920, h: 1080 },
  { label: '4:3', ratio: 4 / 3, w: 1440, h: 1080 },
  { label: '9:16', ratio: 9 / 16, w: 1080, h: 1920 },
  { label: '3:4', ratio: 3 / 4, w: 1080, h: 1440 },
  { label: '21:9', ratio: 21 / 9, w: 2520, h: 1080 }
]

const RatioPanel: React.FC = () => {
  const { t } = useTranslation()
  const { canvasWidth, canvasHeight, resizeBehavior, setResizeBehavior, showToast } = useCanvasStore()
  const [lockRatio, setLockRatio] = useState(false)
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null)

  const applyPreset = (preset: typeof presets[0]) => {
    setSelectedPreset(preset.label)

    // 计算适配屏幕的尺寸
    const screenW = window.screen.availWidth
    const screenH = window.screen.availHeight
    let w = preset.w
    let h = preset.h
    const maxW = Math.floor(screenW * 0.85)
    const maxH = Math.floor(screenH * 0.85)

    if (w > maxW || h > maxH) {
      const scale = Math.min(maxW / w, maxH / h)
      w = Math.floor(w * scale)
      h = Math.floor(h * scale)
    }

    window.electronAPI.setSize(w, h)

    if (lockRatio) {
      window.electronAPI.setAspectRatio(preset.ratio)
    }
  }

  const handleFreeMode = () => {
    setSelectedPreset(null)
    window.electronAPI.clearAspectRatio()
  }

  const handleToggleLock = () => {
    const next = !lockRatio
    setLockRatio(next)
    if (!next) {
      window.electronAPI.clearAspectRatio()
    } else if (selectedPreset) {
      const preset = presets.find((p) => p.label === selectedPreset)
      if (preset) {
        window.electronAPI.setAspectRatio(preset.ratio)
      }
    }
  }

  const handleResizeBehavior = (behavior: 'scale' | 'edge-anchor') => {
    setResizeBehavior(behavior)
    showToast(
      behavior === 'scale' ? t('status.resizeModeScale') : t('status.resizeModeEdgeAnchor')
    )
  }

  return (
    <div className="panel__content">
      <h3 className="panel__title">{t('panel.ratio.title')}</h3>

      <div className="panel__row">
        <span className="panel__label">
          {canvasWidth} × {canvasHeight}
        </span>
      </div>

      <div className="ratio-grid">
        <button
          className={`ratio-btn ${!selectedPreset ? 'ratio-btn--active' : ''}`}
          onClick={handleFreeMode}
        >
          {t('panel.ratio.free')}
        </button>
        {presets.map((preset) => (
          <button
            key={preset.label}
            className={`ratio-btn ${selectedPreset === preset.label ? 'ratio-btn--active' : ''}`}
            onClick={() => applyPreset(preset)}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="panel__row" style={{ marginTop: '12px' }}>
        <label className="panel__label">{t('panel.ratio.lock')}</label>
        <button
          className={`panel__toggle ${lockRatio ? 'panel__toggle--on' : ''}`}
          onClick={handleToggleLock}
        >
          {lockRatio ? 'ON' : 'OFF'}
        </button>
      </div>

      <div className="panel__row" style={{ marginTop: '12px' }}>
        <label className="panel__label">{t('panel.ratio.resizeBehavior')}</label>
      </div>

      <div className="ratio-grid" style={{ marginTop: '8px' }}>
        <button
          className={`ratio-btn ${resizeBehavior === 'scale' ? 'ratio-btn--active' : ''}`}
          onClick={() => handleResizeBehavior('scale')}
        >
          {t('panel.ratio.scaleMode')}
        </button>
        <button
          className={`ratio-btn ${resizeBehavior === 'edge-anchor' ? 'ratio-btn--active' : ''}`}
          onClick={() => handleResizeBehavior('edge-anchor')}
        >
          {t('panel.ratio.edgeAnchorMode')}
        </button>
      </div>
    </div>
  )
}

export default RatioPanel
