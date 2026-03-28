import React from 'react'
import { useTranslation } from 'react-i18next'
import { useCanvasStore } from '../../stores/canvasStore'
import { getFabricCanvas } from '../Canvas/CanvasView'

const LayersPanel: React.FC = () => {
  const { t } = useTranslation()
  const {
    images,
    moveImageUp,
    moveImageDown,
    moveImageToTop,
    moveImageToBottom,
    removeImage,
    updateImage,
    setSelectedImageId,
    showToast
  } = useCanvasStore()

  // 在 Fabric.js 中调整图层顺序
  const handleMoveUp = (id: string) => {
    const canvas = getFabricCanvas()
    if (!canvas) return
    const obj = canvas.getObjects().find((o: any) => o.data?.id === id)
    if (obj) {
      canvas.bringObjectForward(obj)
      canvas.renderAll()
    }
    moveImageUp(id)
  }

  const handleMoveDown = (id: string) => {
    const canvas = getFabricCanvas()
    if (!canvas) return
    const obj = canvas.getObjects().find((o: any) => o.data?.id === id)
    if (obj) {
      canvas.sendObjectBackwards(obj)
      canvas.renderAll()
    }
    moveImageDown(id)
  }

  const handleToggleVisible = (id: string, currentVisible: boolean) => {
    const canvas = getFabricCanvas()
    if (!canvas) return
    const obj = canvas.getObjects().find((o: any) => o.data?.id === id)
    if (obj) {
      obj.set('visible', !currentVisible)
      canvas.renderAll()
    }
    updateImage(id, { visible: !currentVisible })
  }

  const handleToggleLock = (id: string, currentLocked: boolean) => {
    const canvas = getFabricCanvas()
    if (!canvas) return
    const obj = canvas.getObjects().find((o: any) => o.data?.id === id)
    if (obj) {
      obj.set({
        selectable: currentLocked,
        evented: currentLocked,
        lockMovementX: !currentLocked,
        lockMovementY: !currentLocked,
        lockScalingX: !currentLocked,
        lockScalingY: !currentLocked,
        lockRotation: !currentLocked
      })
      canvas.renderAll()
    }
    updateImage(id, { locked: !currentLocked })
  }

  const handleDelete = (id: string) => {
    const canvas = getFabricCanvas()
    if (!canvas) return
    const obj = canvas.getObjects().find((o: any) => o.data?.id === id)
    if (obj) {
      canvas.remove(obj)
      canvas.renderAll()
    }
    removeImage(id)
  }

  const handleSelect = (id: string) => {
    const canvas = getFabricCanvas()
    if (!canvas) return
    const obj = canvas.getObjects().find((o: any) => o.data?.id === id)
    if (obj) {
      canvas.setActiveObject(obj)
      canvas.renderAll()
    }
    setSelectedImageId(id)
  }

  const applyOrderToCanvas = (orderedIdsBottomToTop: string[]) => {
    const canvas = getFabricCanvas()
    if (!canvas) return

    orderedIdsBottomToTop.forEach((id, orderIndex) => {
      const obj = canvas.getObjects().find((o: any) => o.data?.id === id)
      if (obj) {
        canvas.moveObjectTo(obj, orderIndex)
      }
    })

    canvas.renderAll()
  }

  const handleMoveToTop = (id: string) => {
    moveImageToTop(id)
    applyOrderToCanvas(useCanvasStore.getState().images.map((img) => img.id))
    showToast(t('status.layerToTop'))
  }

  const handleMoveToBottom = (id: string) => {
    moveImageToBottom(id)
    applyOrderToCanvas(useCanvasStore.getState().images.map((img) => img.id))
    showToast(t('status.layerToBottom'))
  }

  return (
    <div className="panel__content">
      <h3 className="panel__title">{t('panel.layers.title')}</h3>

      {images.length === 0 ? (
        <p className="panel__empty">{t('panel.layers.empty')}</p>
      ) : (
        <div className="layers-list">
          {/* 从上到下显示（最上层在前） */}
          {[...images].reverse().map((img, index) => (
            <div
              key={img.id}
              className={`layer-item ${useCanvasStore.getState().selectedImageId === img.id ? 'layer-item--selected' : ''}`}
              onClick={() => handleSelect(img.id)}
            >
              <span className="layer-item__name" title={img.name}>
                {img.name}
              </span>
              <div className="layer-item__actions">
                <button
                  className={`layer-item__btn ${img.visible ? '' : 'layer-item__btn--off'}`}
                  onClick={(e) => { e.stopPropagation(); handleToggleVisible(img.id, img.visible) }}
                  title={t('panel.layers.visible')}
                >
                  👁
                </button>
                <button
                  className={`layer-item__btn ${img.locked ? 'layer-item__btn--on' : ''}`}
                  onClick={(e) => { e.stopPropagation(); handleToggleLock(img.id, img.locked) }}
                  title={t('panel.layers.lock')}
                >
                  🔒
                </button>
                <button
                  className="layer-item__btn"
                  onClick={(e) => { e.stopPropagation(); handleMoveUp(img.id) }}
                  title={t('panel.layers.moveUp')}
                  disabled={index === 0}
                >
                  ↑
                </button>
                <button
                  className="layer-item__btn"
                  onClick={(e) => { e.stopPropagation(); handleMoveDown(img.id) }}
                  title={t('panel.layers.moveDown')}
                  disabled={index === images.length - 1}
                >
                  ↓
                </button>
                <button
                  className="layer-item__btn"
                  onClick={(e) => { e.stopPropagation(); handleMoveToTop(img.id) }}
                  title={t('panel.layers.moveToTop')}
                  disabled={index === 0}
                >
                  ⤒
                </button>
                <button
                  className="layer-item__btn"
                  onClick={(e) => { e.stopPropagation(); handleMoveToBottom(img.id) }}
                  title={t('panel.layers.moveToBottom')}
                  disabled={index === images.length - 1}
                >
                  ⤓
                </button>
                <button
                  className="layer-item__btn layer-item__btn--delete"
                  onClick={(e) => { e.stopPropagation(); handleDelete(img.id) }}
                  title={t('panel.layers.delete')}
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default LayersPanel
