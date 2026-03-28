import React, { useEffect, useCallback } from 'react'
import CanvasView, { addImageToCanvas, getFabricCanvas } from './components/Canvas/CanvasView'
import Toolbar from './components/Toolbar/Toolbar'
import DropOverlay from './components/DropZone/DropOverlay'
import { useCanvasStore } from './stores/canvasStore'
import { useTranslation } from 'react-i18next'

const App: React.FC = () => {
  const { toast, showToast } = useCanvasStore()
  const { t } = useTranslation()

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

  // 全局快捷键
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Ctrl+Z 撤销
      if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        useCanvasStore.getState().undo()
      }

      // Ctrl+Y 重做
      if (e.ctrlKey && e.key === 'y') {
        e.preventDefault()
        useCanvasStore.getState().redo()
      }

      // Ctrl+O 打开文件
      if (e.ctrlKey && e.key === 'o') {
        e.preventDefault()
        try {
          const files = await window.electronAPI.openFileDialog()
          for (const file of files) {
            const id = await addImageToCanvas(file.dataUrl, file.name)
            if (id) {
              useCanvasStore.getState().addImage({
                id,
                name: file.name,
                fabricObjectIndex: -1,
                visible: true,
                locked: false
              })
            }
          }
          if (files.length > 0) {
            showToast(
              files.length === 1
                ? t('status.imageAdded')
                : t('status.imagesAdded', { count: files.length })
            )
          }
        } catch (err) {
          console.error('导入失败:', err)
        }
      }

      // Ctrl+Shift+] 置顶图层
      if (e.ctrlKey && e.shiftKey && (e.key === '}' || e.key === ']')) {
        e.preventDefault()
        const { selectedImageId, moveImageToTop } = useCanvasStore.getState()
        if (!selectedImageId) return

        moveImageToTop(selectedImageId)
        const updated = useCanvasStore.getState().images
        applyLayerOrderToCanvas(updated.map((img) => img.id))
        showToast(t('status.layerToTop'))
      }

      // Ctrl+Shift+[ 置底图层
      if (e.ctrlKey && e.shiftKey && (e.key === '{' || e.key === '[')) {
        e.preventDefault()
        const { selectedImageId, moveImageToBottom } = useCanvasStore.getState()
        if (!selectedImageId) return

        moveImageToBottom(selectedImageId)
        const updated = useCanvasStore.getState().images
        applyLayerOrderToCanvas(updated.map((img) => img.id))
        showToast(t('status.layerToBottom'))
      }

      // Ctrl+V 粘贴图片
      if (e.ctrlKey && e.key === 'v') {
        try {
          const clipboardItems = await navigator.clipboard.read()
          for (const item of clipboardItems) {
            for (const type of item.types) {
              if (type.startsWith('image/')) {
                const blob = await item.getType(type)
                const reader = new FileReader()
                reader.onload = async () => {
                  const dataUrl = reader.result as string
                  const id = await addImageToCanvas(dataUrl, 'pasted-image')
                  if (id) {
                    useCanvasStore.getState().addImage({
                      id,
                      name: 'pasted-image',
                      fabricObjectIndex: -1,
                      visible: true,
                      locked: false
                    })
                    showToast(t('status.imageAdded'))
                  }
                }
                reader.readAsDataURL(blob)
              }
            }
          }
        } catch {
          // 剪贴板没有图片，忽略
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showToast, t, applyLayerOrderToCanvas])

  return (
    <div className="app">
      {/* 标题栏拖拽区域 */}
      <div className="app__titlebar" />

      <DropOverlay>
        <CanvasView />
      </DropOverlay>

      <Toolbar />

      {/* Toast 提示 */}
      {toast && (
        <div className="toast">
          <span>{toast}</span>
        </div>
      )}
    </div>
  )
}

export default App
