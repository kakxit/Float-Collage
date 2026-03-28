import React, { useState, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

interface DropOverlayProps {
  children: React.ReactNode
}

const SUPPORTED_EXTS = ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif', 'svg']

const DropOverlay: React.FC<DropOverlayProps> = ({ children }) => {
  const [isDragging, setIsDragging] = useState(false)
  const [isUnsupported, setIsUnsupported] = useState(false)
  const { t } = useTranslation()
  const dragCounter = React.useRef(0)

  useEffect(() => {
    const resetDragState = () => {
      dragCounter.current = 0
      setIsDragging(false)
      setIsUnsupported(false)
    }

    window.addEventListener('dragend', resetDragState)
    window.addEventListener('drop', resetDragState)

    return () => {
      window.removeEventListener('dragend', resetDragState)
      window.removeEventListener('drop', resetDragState)
    }
  }, [])

  const checkSupported = (e: React.DragEvent) => {
    const items = e.dataTransfer.items
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item.kind !== 'file') continue

      const file = item.getAsFile()
      if (!file || !file.name) {
        // 某些平台在 dragenter 阶段无法拿到文件名，避免误判为不支持
        continue
      }

      const ext = file.name.split('.').pop()?.toLowerCase() || ''
      if (!ext) continue
      if (!SUPPORTED_EXTS.includes(ext)) {
        return false
      }
    }
    return true
  }

  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      dragCounter.current += 1

      if (dragCounter.current === 1) {
        const supported = checkSupported(e)
        setIsDragging(true)
        setIsUnsupported(!supported)
      }
    },
    []
  )

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current = Math.max(0, dragCounter.current - 1)
    if (dragCounter.current === 0) {
      setIsDragging(false)
      setIsUnsupported(false)
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    // 不阻止传播，让 CanvasView 处理 drop
    dragCounter.current = 0
    setIsDragging(false)
    setIsUnsupported(false)
  }, [])

  return (
    <div
      className="drop-wrapper"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {children}

      {isDragging && (
        <div className={`drop-overlay ${isUnsupported ? 'drop-overlay--error' : ''}`}>
          <div className="drop-overlay__content">
            <div className="drop-overlay__icon">
              {isUnsupported ? (
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
              ) : (
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              )}
            </div>
            <p className="drop-overlay__text">
              {isUnsupported ? t('dropzone.unsupported') : t('dropzone.hint')}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

export default DropOverlay
