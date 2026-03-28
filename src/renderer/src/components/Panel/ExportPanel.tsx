import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useCanvasStore } from '../../stores/canvasStore'
import { exportCanvas } from '../Canvas/CanvasView'

const ExportPanel: React.FC = () => {
  const { t } = useTranslation()
  const { showToast, canvasWidth, canvasHeight } = useCanvasStore()
  const [format, setFormat] = useState<'png' | 'jpeg' | 'webp'>('png')
  const [quality, setQuality] = useState(0.92)
  const [multiplier, setMultiplier] = useState(1)

  const outputWidth = Math.max(1, Math.round(canvasWidth * multiplier))
  const outputHeight = Math.max(1, Math.round(canvasHeight * multiplier))

  const handleExport = async () => {
    try {
      const base64 = exportCanvas(format, quality, multiplier)
      if (!base64) return

      const ext = format === 'jpeg' ? 'jpg' : format
      const filePath = await window.electronAPI.saveFileDialog(ext)
      if (!filePath) return

      await window.electronAPI.writeExportFile(filePath, base64)
      showToast(t('status.exported'))
    } catch (err) {
      console.error('导出失败:', err)
    }
  }

  return (
    <div className="panel__content">
      <h3 className="panel__title">{t('panel.export.title')}</h3>

      <div className="panel__row">
        <label className="panel__label">{t('panel.export.format')}</label>
        <select
          className="panel__select"
          value={format}
          onChange={(e) => setFormat(e.target.value as 'png' | 'jpeg' | 'webp')}
        >
          <option value="png">PNG</option>
          <option value="jpeg">JPG</option>
          <option value="webp">WebP</option>
        </select>
      </div>

      <div className="panel__row">
        <label className="panel__label">{t('panel.export.scale')}</label>
        <select
          className="panel__select"
          value={multiplier}
          onChange={(e) => setMultiplier(parseFloat(e.target.value))}
        >
          <option value={1}>1x</option>
          <option value={1.5}>1.5x</option>
          <option value={2}>2x</option>
          <option value={3}>3x</option>
          <option value={4}>4x</option>
        </select>
      </div>

      <div className="panel__row">
        <label className="panel__label">{t('panel.export.outputSize')}</label>
        <span className="panel__value" style={{ minWidth: '92px' }}>
          {outputWidth} × {outputHeight}
        </span>
      </div>

      <div className="panel__actions">
        <button className="panel__btn panel__btn--primary panel__btn--full" onClick={handleExport}>
          {t('panel.export.exportBtn')}
        </button>
      </div>
    </div>
  )
}

export default ExportPanel
