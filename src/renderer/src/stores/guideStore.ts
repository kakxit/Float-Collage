import { create } from 'zustand'
import type { GuideLine } from '../../../shared/types'

interface GuideState {
  guides: GuideLine[]
  horizontalCount: number
  verticalCount: number

  setHorizontalCount: (count: number) => void
  setVerticalCount: (count: number) => void

  // 生成等距参考线
  generateGuides: (canvasWidth: number, canvasHeight: number) => void

  // 更新单条参考线的位置（拖拽时）
  updateGuidePosition: (id: string, position: number) => void

  // 联动更新（手风琴效果）：拖动边缘线时，中间线等距重新分布
  updateEdgeGuide: (
    id: string,
    newPosition: number,
    canvasWidth: number,
    canvasHeight: number
  ) => void

  // 清除所有参考线
  clearGuides: () => void

  // 添加/删除单条参考线
  addGuide: (guide: GuideLine) => void
  removeGuide: (id: string) => void

  // 参考线可见性
  guidesVisible: boolean
  setGuidesVisible: (visible: boolean) => void
}

let guideIdCounter = 0
function nextGuideId(): string {
  return `guide-${++guideIdCounter}`
}

export const useGuideStore = create<GuideState>((set, get) => ({
  guides: [],
  horizontalCount: 0,
  verticalCount: 0,
  guidesVisible: true,

  setHorizontalCount: (count) => set({ horizontalCount: Math.max(0, Math.min(20, count)) }),
  setVerticalCount: (count) => set({ verticalCount: Math.max(0, Math.min(20, count)) }),

  generateGuides: (canvasWidth, canvasHeight) => {
    const { horizontalCount, verticalCount } = get()
    const newGuides: GuideLine[] = []

    // 生成水平参考线（等距分布）
    for (let i = 1; i <= horizontalCount; i++) {
      newGuides.push({
        id: nextGuideId(),
        type: 'horizontal',
        position: (canvasHeight / (horizontalCount + 1)) * i
      })
    }

    // 生成垂直参考线（等距分布）
    for (let i = 1; i <= verticalCount; i++) {
      newGuides.push({
        id: nextGuideId(),
        type: 'vertical',
        position: (canvasWidth / (verticalCount + 1)) * i
      })
    }

    set({ guides: newGuides })
  },

  updateGuidePosition: (id, position) =>
    set((state) => ({
      guides: state.guides.map((g) => (g.id === id ? { ...g, position } : g))
    })),

  updateEdgeGuide: (id, newPosition, _canvasWidth, _canvasHeight) => {
    const { guides } = get()
    const guide = guides.find((g) => g.id === id)
    if (!guide) return

    const sameTypeGuides = guides
      .filter((g) => g.type === guide.type)
      .sort((a, b) => a.position - b.position)

    const guideIndex = sameTypeGuides.findIndex((g) => g.id === id)
    const isFirstEdge = guideIndex === 0
    const isLastEdge = guideIndex === sameTypeGuides.length - 1

    if (!isFirstEdge && !isLastEdge) {
      // 非边缘线，直接更新位置
      set((state) => ({
        guides: state.guides.map((g) => (g.id === id ? { ...g, position: newPosition } : g))
      }))
      return
    }

    // 边缘线拖拽 → 手风琴重新分布
    const otherEdgePos = isFirstEdge
      ? sameTypeGuides[sameTypeGuides.length - 1].position
      : sameTypeGuides[0].position

    const startPos = isFirstEdge ? newPosition : otherEdgePos
    const endPos = isFirstEdge ? otherEdgePos : newPosition
    const count = sameTypeGuides.length

    if (count <= 1) {
      set((state) => ({
        guides: state.guides.map((g) => (g.id === id ? { ...g, position: newPosition } : g))
      }))
      return
    }

    const step = (endPos - startPos) / (count - 1)
    const updatedIds = new Map<string, number>()
    sameTypeGuides.forEach((g, i) => {
      updatedIds.set(g.id, startPos + step * i)
    })

    set((state) => ({
      guides: state.guides.map((g) =>
        updatedIds.has(g.id) ? { ...g, position: updatedIds.get(g.id)! } : g
      )
    }))
  },

  clearGuides: () => set({ guides: [], horizontalCount: 0, verticalCount: 0 }),

  addGuide: (guide) => set((state) => ({ guides: [...state.guides, guide] })),

  removeGuide: (id) =>
    set((state) => ({
      guides: state.guides.filter((g) => g.id !== id)
    })),

  setGuidesVisible: (visible) => set({ guidesVisible: visible })
}))
