import { create } from 'zustand'
import type { CanvasImage } from '../../../shared/types'

// 撤销/重做命令接口
interface Command {
  execute: () => void
  undo: () => void
  description: string
}

interface CanvasState {
  // 画布尺寸
  canvasWidth: number
  canvasHeight: number
  setCanvasSize: (width: number, height: number) => void

  // 窗口缩放策略
  resizeBehavior: 'scale' | 'edge-anchor'
  setResizeBehavior: (behavior: 'scale' | 'edge-anchor') => void

  // 背景透明度 (0-100)
  backgroundOpacity: number
  setBackgroundOpacity: (opacity: number) => void

  // 图层列表
  images: CanvasImage[]
  addImage: (image: CanvasImage) => void
  removeImage: (id: string) => void
  updateImage: (id: string, updates: Partial<CanvasImage>) => void
  reorderImages: (images: CanvasImage[]) => void
  moveImageUp: (id: string) => void
  moveImageDown: (id: string) => void
  moveImageToTop: (id: string) => void
  moveImageToBottom: (id: string) => void

  // 鼠标穿透
  isPassthrough: boolean
  setPassthrough: (value: boolean) => void

  // 当前选中图片
  selectedImageId: string | null
  setSelectedImageId: (id: string | null) => void

  // 当前使用的工具
  activeTool: 'select' | 'pan'
  setActiveTool: (tool: 'select' | 'pan') => void

  // 撤销/重做
  undoStack: Command[]
  redoStack: Command[]
  pushCommand: (command: Command) => void
  undo: () => void
  redo: () => void

  // 吸附配置
  snapEnabled: boolean
  snapThreshold: number
  alignLinesVisible: boolean
  setSnapEnabled: (enabled: boolean) => void
  setSnapThreshold: (threshold: number) => void
  setAlignLinesVisible: (visible: boolean) => void

  // 状态提示信息
  toast: string | null
  showToast: (message: string) => void
  clearToast: () => void
}

const RESIZE_BEHAVIOR_STORAGE_KEY = 'freepn.resizeBehavior'

const getInitialResizeBehavior = (): 'scale' | 'edge-anchor' => {
  if (typeof window === 'undefined') return 'scale'

  const saved = window.localStorage.getItem(RESIZE_BEHAVIOR_STORAGE_KEY)
  return saved === 'edge-anchor' ? 'edge-anchor' : 'scale'
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  // 画布尺寸
  canvasWidth: 1270,
  canvasHeight: 960,
  setCanvasSize: (width, height) => set({ canvasWidth: width, canvasHeight: height }),

  // 窗口缩放策略
  resizeBehavior: getInitialResizeBehavior(),
  setResizeBehavior: (behavior) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(RESIZE_BEHAVIOR_STORAGE_KEY, behavior)
    }
    set({ resizeBehavior: behavior })
  },

  // 透明度
  backgroundOpacity: 85,
  setBackgroundOpacity: (opacity) => set({ backgroundOpacity: Math.max(0, Math.min(100, opacity)) }),

  // 图层
  images: [],
  addImage: (image) => set((state) => ({ images: [...state.images, image] })),
  removeImage: (id) => set((state) => ({ images: state.images.filter((img) => img.id !== id) })),
  updateImage: (id, updates) =>
    set((state) => ({
      images: state.images.map((img) => (img.id === id ? { ...img, ...updates } : img))
    })),
  reorderImages: (images) => set({ images }),
  moveImageUp: (id) =>
    set((state) => {
      const idx = state.images.findIndex((img) => img.id === id)
      if (idx < state.images.length - 1) {
        const newImages = [...state.images]
        ;[newImages[idx], newImages[idx + 1]] = [newImages[idx + 1], newImages[idx]]
        return { images: newImages }
      }
      return state
    }),
  moveImageDown: (id) =>
    set((state) => {
      const idx = state.images.findIndex((img) => img.id === id)
      if (idx > 0) {
        const newImages = [...state.images]
        ;[newImages[idx], newImages[idx - 1]] = [newImages[idx - 1], newImages[idx]]
        return { images: newImages }
      }
      return state
    }),
  moveImageToTop: (id) =>
    set((state) => {
      const idx = state.images.findIndex((img) => img.id === id)
      if (idx === -1 || idx === state.images.length - 1) return state
      const target = state.images[idx]
      const rest = state.images.filter((img) => img.id !== id)
      return { images: [...rest, target] }
    }),
  moveImageToBottom: (id) =>
    set((state) => {
      const idx = state.images.findIndex((img) => img.id === id)
      if (idx <= 0) return state
      const target = state.images[idx]
      const rest = state.images.filter((img) => img.id !== id)
      return { images: [target, ...rest] }
    }),

  // 鼠标穿透
  isPassthrough: false,
  setPassthrough: (value) => set({ isPassthrough: value }),

  // 选中
  selectedImageId: null,
  setSelectedImageId: (id) => set({ selectedImageId: id }),

  // 工具
  activeTool: 'select',
  setActiveTool: (tool) => set({ activeTool: tool }),

  // 撤销/重做
  undoStack: [],
  redoStack: [],
  pushCommand: (command) =>
    set((state) => ({
      undoStack: [...state.undoStack.slice(-50), command], // 最多保留 50 步
      redoStack: []
    })),
  undo: () => {
    const { undoStack } = get()
    if (undoStack.length === 0) return
    const command = undoStack[undoStack.length - 1]
    command.undo()
    set((state) => ({
      undoStack: state.undoStack.slice(0, -1),
      redoStack: [...state.redoStack, command]
    }))
  },
  redo: () => {
    const { redoStack } = get()
    if (redoStack.length === 0) return
    const command = redoStack[redoStack.length - 1]
    command.execute()
    set((state) => ({
      redoStack: state.redoStack.slice(0, -1),
      undoStack: [...state.undoStack, command]
    }))
  },

  // 吸附
  snapEnabled: true,
  snapThreshold: 5,
  alignLinesVisible: true,
  setSnapEnabled: (enabled) => set({ snapEnabled: enabled }),
  setSnapThreshold: (threshold) => set({ snapThreshold: threshold }),
  setAlignLinesVisible: (visible) => set({ alignLinesVisible: visible }),

  // Toast
  toast: null,
  showToast: (message) => {
    set({ toast: message })
    setTimeout(() => set({ toast: null }), 2500)
  },
  clearToast: () => set({ toast: null })
}))
