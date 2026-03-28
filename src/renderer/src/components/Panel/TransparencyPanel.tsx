import React from 'react'
import { useTranslation } from 'react-i18next'
import { useCanvasStore } from '../../stores/canvasStore'

const TransparencyPanel: React.FC = () => {
  const { t } = useTranslation()
  const { backgroundOpacity, setBackgroundOpacity } = useCanvasStore()

  return (
    <div className="panel__content">
      <h3 className="panel__title">{t('panel.transparency.title')}</h3>

      <div className="panel__row">
        <label className="panel__label">{t('panel.transparency.opacity')}</label>
        <input
          type="range"
          className="panel__slider"
          min={0}
          max={100}
          step={1}
          value={backgroundOpacity}
          onChange={(e) => setBackgroundOpacity(parseInt(e.target.value))}
        />
        <span className="panel__value">{backgroundOpacity}%</span>
      </div>

      {/* 预设快捷按钮 */}
      <div className="transparency-presets">
        {[0, 25, 50, 75, 100].map((val) => (
          <button
            key={val}
            className={`transparency-preset ${backgroundOpacity === val ? 'transparency-preset--active' : ''}`}
            onClick={() => setBackgroundOpacity(val)}
          >
            {val}%
          </button>
        ))}
      </div>
    </div>
  )
}

export default TransparencyPanel
