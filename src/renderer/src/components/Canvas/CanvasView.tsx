import React, { useRef, useEffect, useCallback } from 'react'
import * as fabric from 'fabric'
import { useCanvasStore } from '../../stores/canvasStore'
import { useGuideStore } from '../../stores/guideStore'
import { SnappingEngine, type AlignLine } from './SnappingEngine'
import { useTranslation } from 'react-i18next'

// Fabric.js 画布实例全局引用（供外部组件调用）
let fabricCanvas: fabric.Canvas | null = null
let snappingEngine: SnappingEngine | null = null

// 存储临时对齐线对象
let tempAlignLines: fabric.Line[] = []

// 图片对象的自定义属性标记
const IMAGE_TYPE = 'user-image'
const GUIDE_TYPE = 'guide-line'
const ALIGN_TYPE = 'align-line'

interface ImageData {
  id: string
  name: string
  type: string
}

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))

const getPointerClientPosition = (event: MouseEvent | TouchEvent): { x: number; y: number } | null => {
  if ('clientX' in event && 'clientY' in event) {
    return { x: event.clientX, y: event.clientY }
  }

  if ('touches' in event && event.touches.length > 0) {
    return { x: event.touches[0].clientX, y: event.touches[0].clientY }
  }

  if ('changedTouches' in event && event.changedTouches.length > 0) {
    return { x: event.changedTouches[0].clientX, y: event.changedTouches[0].clientY }
  }

  return null
}

export function getFabricCanvas(): fabric.Canvas | null {
  return fabricCanvas
}

/**
 * 向画布添加图片
 */
export async function addImageToCanvas(dataUrl: string, name: string): Promise<string> {
  if (!fabricCanvas) return ''

  const id = `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  return new Promise((resolve) => {
    const imgElement = new Image()
    imgElement.onload = () => {
      const fabricImg = new fabric.FabricImage(imgElement, {
        left: 50 + Math.random() * 100,
        top: 50 + Math.random() * 100,
        // 自定义属性
        data: { id, name, type: IMAGE_TYPE }
      } as fabric.TOptions<fabric.FabricObjectProps>)

      // 如果图片太大，缩放到画布尺寸的 80%
      const canvas = fabricCanvas!
      const maxW = canvas.getWidth() * 0.8
      const maxH = canvas.getHeight() * 0.8
      if (fabricImg.width! > maxW || fabricImg.height! > maxH) {
        const scale = Math.min(maxW / fabricImg.width!, maxH / fabricImg.height!)
        fabricImg.scale(scale)
      }

      canvas.add(fabricImg)
      canvas.setActiveObject(fabricImg)
      canvas.renderAll()
      resolve(id)
    }
    imgElement.src = dataUrl
  })
}

/**
 * 从画布删除图片
 */
export function removeImageFromCanvas(id: string): void {
  if (!fabricCanvas) return
  const objects = fabricCanvas.getObjects()
  const target = objects.find(
    (obj) => (obj as any).data?.id === id && (obj as any).data?.type === IMAGE_TYPE
  )
  if (target) {
    fabricCanvas.remove(target)
    fabricCanvas.renderAll()
  }
}

/**
 * 导出画布为 base64 图片
 */
export function exportCanvas(
  format: 'png' | 'jpeg' | 'webp',
  quality: number,
  multiplier: number = 1
): string {
  if (!fabricCanvas) return ''

  // 先隐藏参考线和对齐线
  const hiddenObjects: fabric.FabricObject[] = []
  fabricCanvas.getObjects().forEach((obj) => {
    const data = (obj as any).data
    if (data?.type === GUIDE_TYPE || data?.type === ALIGN_TYPE) {
      obj.set('visible', false)
      hiddenObjects.push(obj)
    }
  })

  const dataUrl = fabricCanvas.toDataURL({
    format: format === 'jpeg' ? 'jpeg' : 'png',
    quality,
    multiplier
  })

  // 恢复隐藏的对象
  hiddenObjects.forEach((obj) => obj.set('visible', true))
  fabricCanvas.renderAll()

  const base64 = dataUrl.split(',')[1]
  return base64 ?? ''
}

const CanvasView: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const isPanning = useRef(false)
  const lastPanPoint = useRef<{ x: number; y: number } | null>(null)
  const alignLinesVisibleRef = useRef(true)
  const spacePressed = useRef(false)
  const altPressed = useRef(false)
  const { t } = useTranslation()

  const {
    canvasWidth,
    canvasHeight,
    setCanvasSize,
    resizeBehavior,
    backgroundOpacity,
    addImage,
    removeImage,
    setSelectedImageId,
    images,
    snapEnabled,
    snapThreshold,
    alignLinesVisible,
    showToast
  } = useCanvasStore()

  const prevCanvasSizeRef = useRef<{ width: number; height: number }>({
    width: canvasWidth,
    height: canvasHeight
  })

  const { guides, guidesVisible, updateEdgeGuide } = useGuideStore()

  // 初始化 Fabric.js 画布
  useEffect(() => {
    if (!canvasRef.current) return

    const canvas = new fabric.Canvas(canvasRef.current, {
      width: canvasWidth,
      height: canvasHeight,
      backgroundColor: 'transparent',
      selection: true,
      preserveObjectStacking: true
    })

    fabricCanvas = canvas
    snappingEngine = new SnappingEngine()

    // =====================
    // 事件：选中对象
    // =====================
    canvas.on('selection:created', (e) => {
      const selected = e.selected?.[0]
      if (selected && (selected as any).data?.type === IMAGE_TYPE) {
        setSelectedImageId((selected as any).data.id)
      }
    })

    canvas.on('selection:updated', (e) => {
      const selected = e.selected?.[0]
      if (selected && (selected as any).data?.type === IMAGE_TYPE) {
        setSelectedImageId((selected as any).data.id)
      }
    })

    canvas.on('selection:cleared', () => {
      setSelectedImageId(null)
    })

    // =====================
    // 事件：对象移动时的吸附
    // =====================
    canvas.on('object:moving', (e) => {
      if (!snappingEngine || altPressed.current) return

      const movingObj = e.target
      if (!movingObj || (movingObj as any).data?.type !== IMAGE_TYPE) return

      // 获取所有图片对象
      const allImageObjects = canvas.getObjects().filter(
        (obj) => (obj as any).data?.type === IMAGE_TYPE
      )

      // 参考线位置
      const guidePositions = {
        horizontal: useGuideStore
          .getState()
          .guides.filter((g) => g.type === 'horizontal')
          .map((g) => g.position),
        vertical: useGuideStore
          .getState()
          .guides.filter((g) => g.type === 'vertical')
          .map((g) => g.position)
      }

      const result = snappingEngine.calculateSnap(movingObj, allImageObjects, guidePositions)

      // 应用吸附
      if (result.snappedLeft !== null) movingObj.set('left', result.snappedLeft)
      if (result.snappedTop !== null) movingObj.set('top', result.snappedTop)

      // 清除旧对齐线
      clearTempAlignLines(canvas)

      // 绘制新对齐线
      if (alignLinesVisibleRef.current) {
        result.alignLines.forEach((line) => {
          drawAlignLine(canvas, line)
        })
      }

      canvas.renderAll()
    })

    // 移动结束后清除对齐线
    canvas.on('object:modified', () => {
      clearTempAlignLines(canvas)
      canvas.renderAll()
    })

    // 按键事件
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spacePressed.current = true
        if (canvas) {
          canvas.defaultCursor = 'grab'
          canvas.selection = false
        }
      }
      if (e.code === 'AltLeft' || e.code === 'AltRight') {
        altPressed.current = true
      }
      // Delete 键删除选中对象
      if (e.code === 'Delete' || e.code === 'Backspace') {
        const active = canvas.getActiveObject()
        if (active && (active as any).data?.type === IMAGE_TYPE) {
          const id = (active as any).data.id
          canvas.remove(active)
          removeImage(id)
          canvas.renderAll()
        }
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spacePressed.current = false
        if (canvas) {
          canvas.defaultCursor = 'default'
          canvas.selection = true
        }
      }
      if (e.code === 'AltLeft' || e.code === 'AltRight') {
        altPressed.current = false
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    // =====================
    // Space + 鼠标拖拽 = 平移画布
    // =====================
    canvas.on('mouse:down', (opt) => {
      if (spacePressed.current) {
        const pointer = getPointerClientPosition(opt.e)
        if (!pointer) return

        isPanning.current = true
        lastPanPoint.current = pointer
        canvas.defaultCursor = 'grabbing'
      }
    })

    canvas.on('mouse:move', (opt) => {
      if (isPanning.current && lastPanPoint.current) {
        const pointer = getPointerClientPosition(opt.e)
        if (!pointer) return

        const vpt = canvas.viewportTransform!
        vpt[4] += pointer.x - lastPanPoint.current.x
        vpt[5] += pointer.y - lastPanPoint.current.y
        lastPanPoint.current = pointer
        canvas.requestRenderAll()
      }
    })

    canvas.on('mouse:up', () => {
      isPanning.current = false
      lastPanPoint.current = null
      if (spacePressed.current) {
        canvas.defaultCursor = 'grab'
      }
    })

    // =====================
    // Alt + 滚轮 = 调节透明度
    // =====================
    canvas.on('mouse:wheel', (opt) => {
      if (opt.e.altKey) {
        opt.e.preventDefault()
        const delta = opt.e.deltaY > 0 ? -5 : 5
        const current = useCanvasStore.getState().backgroundOpacity
        useCanvasStore.getState().setBackgroundOpacity(current + delta)
      }
    })

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      canvas.dispose()
      fabricCanvas = null
      snappingEngine = null
      prevCanvasSizeRef.current = { width: canvasWidth, height: canvasHeight }
    }
  }, []) // 仅初始化一次

  // 更新吸附引擎配置
  useEffect(() => {
    if (snappingEngine) {
      snappingEngine.setEnabled(snapEnabled)
      snappingEngine.setThreshold(snapThreshold)
    }
  }, [snapEnabled, snapThreshold])

  useEffect(() => {
    alignLinesVisibleRef.current = alignLinesVisible
    if (!alignLinesVisible && fabricCanvas) {
      clearTempAlignLines(fabricCanvas)
      fabricCanvas.renderAll()
    }
  }, [alignLinesVisible])

  // 窗口 resize → 同步画布尺寸
  useEffect(() => {
    const cleanup = window.electronAPI?.onWindowResized(({ width, height }) => {
      if (!fabricCanvas) return

      const prev = prevCanvasSizeRef.current
      const prevWidth = prev.width || width
      const prevHeight = prev.height || height

      const imageObjects = fabricCanvas
        .getObjects()
        .filter((obj) => (obj as any).data?.type === IMAGE_TYPE)

      if (resizeBehavior === 'scale') {
        const ratioX = width / prevWidth
        const ratioY = height / prevHeight
        const ratio = Math.min(ratioX, ratioY)

        imageObjects.forEach((obj) => {
          obj.scale((obj.scaleX ?? 1) * ratio)
          obj.set({
            left: (obj.left ?? 0) * ratioX,
            top: (obj.top ?? 0) * ratioY
          })
          obj.setCoords()
        })
      } else {
        imageObjects.forEach((obj) => {
          const nextLeft = clamp(obj.left ?? 0, 0, Math.max(0, width - obj.getScaledWidth()))
          const nextTop = clamp(obj.top ?? 0, 0, Math.max(0, height - obj.getScaledHeight()))
          obj.set({ left: nextLeft, top: nextTop })
          obj.setCoords()
        })
      }

      fabricCanvas.setDimensions({ width, height })
      fabricCanvas.renderAll()
      prevCanvasSizeRef.current = { width, height }
      setCanvasSize(width, height)
    })

    return () => cleanup?.()
  }, [resizeBehavior, setCanvasSize])

  // 更新参考线渲染
  useEffect(() => {
    if (!fabricCanvas) return

    // 移除旧参考线
    const oldGuides = fabricCanvas
      .getObjects()
      .filter((obj) => (obj as any).data?.type === GUIDE_TYPE)
    oldGuides.forEach((obj) => fabricCanvas!.remove(obj))

    if (!guidesVisible) {
      fabricCanvas.renderAll()
      return
    }

    // 绘制新参考线
    guides.forEach((guide) => {
      let line: fabric.Line

      if (guide.type === 'horizontal') {
        line = new fabric.Line([0, guide.position, fabricCanvas!.getWidth(), guide.position], {
          stroke: '#4a9eff',
          strokeWidth: 1,
          strokeDashArray: [8, 4],
          selectable: true,
          evented: true,
          hasControls: false,
          hasBorders: false,
          lockMovementX: true,
          lockRotation: true,
          hoverCursor: 'ns-resize',
          moveCursor: 'ns-resize',
          data: { type: GUIDE_TYPE, guideId: guide.id }
        } as any)
      } else {
        line = new fabric.Line([guide.position, 0, guide.position, fabricCanvas!.getHeight()], {
          stroke: '#4a9eff',
          strokeWidth: 1,
          strokeDashArray: [8, 4],
          selectable: true,
          evented: true,
          hasControls: false,
          hasBorders: false,
          lockMovementY: true,
          lockRotation: true,
          hoverCursor: 'ew-resize',
          moveCursor: 'ew-resize',
          data: { type: GUIDE_TYPE, guideId: guide.id }
        } as any)
      }

      fabricCanvas!.add(line)
    })

    // 参考线拖拽事件
    fabricCanvas.on('object:moving', (e) => {
      const obj = e.target
      if ((obj as any).data?.type !== GUIDE_TYPE) return

      const guideId = (obj as any).data.guideId
      const guide = guides.find((g) => g.id === guideId)
      if (!guide) return

      if (guide.type === 'horizontal') {
        const newPos = obj.top ?? 0
        updateEdgeGuide(guideId, newPos, fabricCanvas!.getWidth(), fabricCanvas!.getHeight())
      } else {
        const newPos = obj.left ?? 0
        updateEdgeGuide(guideId, newPos, fabricCanvas!.getWidth(), fabricCanvas!.getHeight())
      }
    })

    fabricCanvas.renderAll()
  }, [guides, guidesVisible, canvasWidth, canvasHeight])

  // 拖拽导入处理
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()

      const files = e.dataTransfer.files
      if (!files.length) return

      const filePaths: string[] = []
      for (let i = 0; i < files.length; i++) {
        const absolutePath = (files[i] as any).path
        if (typeof absolutePath === 'string' && absolutePath.length > 0) {
          filePaths.push(absolutePath)
        }
      }

      const uriList = e.dataTransfer.getData('text/uri-list')
      if (uriList) {
        uriList
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter((line) => line.startsWith('file://'))
          .forEach((uri) => filePaths.push(uri))
      }

      const uniquePaths = Array.from(new Set(filePaths))

      if (!uniquePaths.length) {
        console.warn('[drop-import] no usable paths from DataTransfer, falling back to FileReader', {
          fileCount: files.length,
          itemsCount: e.dataTransfer.items.length
        })

        let importedCount = 0
        for (let i = 0; i < files.length; i++) {
          const file = files[i]
          const ext = file.name.split('.').pop()?.toLowerCase() || ''
          const supportedExts = ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif', 'svg']
          if (!supportedExts.includes(ext)) {
            continue
          }

          try {
            const dataUrl = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader()
              reader.onload = () => resolve(reader.result as string)
              reader.onerror = () => reject(reader.error)
              reader.readAsDataURL(file)
            })

            const id = await addImageToCanvas(dataUrl, file.name || `dropped-${i + 1}`)
            if (id) {
              addImage({
                id,
                name: file.name || `dropped-${i + 1}`,
                fabricObjectIndex: -1,
                visible: true,
                locked: false
              })
              importedCount += 1
            }
          } catch (error) {
            console.warn('[drop-import] FileReader fallback failed', { name: file.name, error })
          }
        }

        if (importedCount > 0) {
          showToast(importedCount === 1 ? t('status.imageAdded') : t('status.imagesAdded', { count: importedCount }))
        } else {
          showToast(t('dropzone.unsupported'))
        }
        return
      }

      console.debug('[drop-import] collected paths', {
        total: uniquePaths.length,
        sample: uniquePaths.slice(0, 3)
      })

      try {
        const importedFiles = await window.electronAPI.readDroppedFiles(uniquePaths)
        if (importedFiles.length === 0) {
          console.warn('[drop-import] main returned 0 supported files', {
            incoming: uniquePaths.length
          })
          showToast(t('dropzone.unsupported'))
          return
        }

        for (const file of importedFiles) {
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

        if (importedFiles.length === 1) {
          showToast(t('status.imageAdded'))
        } else {
          showToast(t('status.imagesAdded', { count: importedFiles.length }))
        }
      } catch (err) {
        console.error('导入文件失败:', err)
      }
    },
    [addImage, showToast, t]
  )

  // 背景透明度样式
  const bgAlpha = backgroundOpacity / 100
  const bgColor = `rgba(24, 24, 32, ${bgAlpha})`

  return (
    <div
      ref={containerRef}
      className="canvas-container"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      style={{ backgroundColor: bgColor }}
    >
      <canvas ref={canvasRef} id="main-canvas" />
    </div>
  )
}

// 绘制临时对齐线
function drawAlignLine(canvas: fabric.Canvas, lineInfo: AlignLine): void {
  let line: fabric.Line
  if (lineInfo.type === 'horizontal') {
    line = new fabric.Line([0, lineInfo.position, canvas.getWidth(), lineInfo.position], {
      stroke: '#00ff88',
      strokeWidth: 1,
      strokeDashArray: [4, 4],
      selectable: false,
      evented: false,
      data: { type: ALIGN_TYPE }
    } as any)
  } else {
    line = new fabric.Line([lineInfo.position, 0, lineInfo.position, canvas.getHeight()], {
      stroke: '#00ff88',
      strokeWidth: 1,
      strokeDashArray: [4, 4],
      selectable: false,
      evented: false,
      data: { type: ALIGN_TYPE }
    } as any)
  }
  canvas.add(line)
  tempAlignLines.push(line)
}

// 清除临时对齐线
function clearTempAlignLines(canvas: fabric.Canvas): void {
  tempAlignLines.forEach((line) => canvas.remove(line))
  tempAlignLines = []
}

export default CanvasView
