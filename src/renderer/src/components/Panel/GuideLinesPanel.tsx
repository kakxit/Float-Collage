import React from 'react'
import { useTranslation } from 'react-i18next'
import { useGuideStore } from '../../stores/guideStore'
import { useCanvasStore } from '../../stores/canvasStore'

const GuideLinesPanel: React.FC = () => {
  const { t } = useTranslation()
  const {
    horizontalCount,
    verticalCount,
    setHorizontalCount,
    setVerticalCount,
    generateGuides,
    clearGuides,
    guidesVisible,
    setGuidesVisible
  } = useGuideStore()

  const {
    canvasWidth,
    canvasHeight,
    snapEnabled,
    snapThreshold,
    alignLinesVisible,
    setSnapEnabled,
    setSnapThreshold,
    setAlignLinesVisible,
    showToast
  } = useCanvasStore()

  return (
    <div className="panel__content">
      <h3 className="panel__title">{t('panel.guides.title')}</h3>

      <div className="panel__row">
        <label className="panel__label">{t('panel.guides.visible')}</label>
        <button
          className={`panel__toggle ${guidesVisible ? 'panel__toggle--on' : ''}`}
          onClick={() => setGuidesVisible(!guidesVisible)}
        >
          {guidesVisible ? 'ON' : 'OFF'}
        </button>
      </div>

      <div className="panel__row">
        <label className="panel__label">{t('panel.guides.snapEnabled')}</label>
        <button
          className={`panel__toggle ${snapEnabled ? 'panel__toggle--on' : ''}`}
          onClick={() => {
            const next = !snapEnabled
            setSnapEnabled(next)
            showToast(next ? t('status.snapOn') : t('status.snapOff'))
          }}
        >
          {snapEnabled ? 'ON' : 'OFF'}
        </button>
      </div>

      <div className="panel__row">
        <label className="panel__label">{t('panel.guides.alignLinesVisible')}</label>
        <button
          className={`panel__toggle ${alignLinesVisible ? 'panel__toggle--on' : ''}`}
          onClick={() => {
            const next = !alignLinesVisible
            setAlignLinesVisible(next)
            showToast(next ? t('status.alignLinesOn') : t('status.alignLinesOff'))
          }}
        >
          {alignLinesVisible ? 'ON' : 'OFF'}
        </button>
      </div>

      <div className="panel__row">
        <label className="panel__label">{t('panel.guides.snapThreshold')}</label>
        <input
          type="range"
          className="panel__slider"
          min={1}
          max={20}
          step={1}
          value={snapThreshold}
          onChange={(e) => setSnapThreshold(parseInt(e.target.value) || 1)}
        />
        <span className="panel__value">{snapThreshold}px</span>
      </div>

      <div className="panel__row">
        <label className="panel__label">{t('panel.guides.horizontal')}</label>
        <input
          type="number"
          className="panel__input"
          value={horizontalCount}
          min={0}
          max={20}
          onChange={(e) => setHorizontalCount(parseInt(e.target.value) || 0)}
        />
      </div>

      <div className="panel__row">
        <label className="panel__label">{t('panel.guides.vertical')}</label>
        <input
          type="number"
          className="panel__input"
          value={verticalCount}
          min={0}
          max={20}
          onChange={(e) => setVerticalCount(parseInt(e.target.value) || 0)}
        />
      </div>

      <div className="panel__actions">
        <button
          className="panel__btn panel__btn--primary"
          onClick={() => generateGuides(canvasWidth, canvasHeight)}
        >
          {t('panel.guides.generate')}
        </button>
        <button className="panel__btn panel__btn--secondary" onClick={clearGuides}>
          {t('panel.guides.clear')}
        </button>
      </div>
    </div>
  )
}

export default GuideLinesPanel
