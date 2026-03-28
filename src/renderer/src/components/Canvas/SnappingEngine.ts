import * as fabric from 'fabric'

// 吸附结果
interface SnapResult {
  snappedLeft: number | null
  snappedTop: number | null
  alignLines: AlignLine[]
}

// 对齐线（用于视觉显示）
export interface AlignLine {
  type: 'horizontal' | 'vertical'
  position: number
  start: number
  end: number
}

/**
 * 吸附引擎：计算图片与其他图片、参考线之间的吸附
 */
export class SnappingEngine {
  private threshold: number = 5
  private enabled: boolean = true

  setThreshold(threshold: number): void {
    this.threshold = threshold
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled
  }

  /**
   * 计算移动对象的吸附位置
   * @param movingObj 正在拖拽的对象
   * @param allObjects 画布上的所有对象（不包括参考线和蒙版）
   * @param guidePositions 参考线位置
   * @returns 吸附结果（修正后的坐标 + 要显示的对齐线）
   */
  calculateSnap(
    movingObj: fabric.FabricObject,
    allObjects: fabric.FabricObject[],
    guidePositions: { horizontal: number[]; vertical: number[] }
  ): SnapResult {
    if (!this.enabled) {
      return { snappedLeft: null, snappedTop: null, alignLines: [] }
    }

    const movingBounds = this.getBounds(movingObj)
    const alignLines: AlignLine[] = []
    let snappedLeft: number | null = null
    let snappedTop: number | null = null

    // 收集所有对齐目标点
    const hTargets: number[] = [...guidePositions.horizontal] // 水平参考线 → y 位置
    const vTargets: number[] = [...guidePositions.vertical]   // 垂直参考线 → x 位置

    // 从其他对象收集边缘和中心位置
    for (const obj of allObjects) {
      if (obj === movingObj) continue
      const bounds = this.getBounds(obj)
      // y 方向目标：上边、下边、中心
      hTargets.push(bounds.top, bounds.bottom, bounds.centerY)
      // x 方向目标：左边、右边、中心
      vTargets.push(bounds.left, bounds.right, bounds.centerX)
    }

    // 检测 y 方向吸附（水平对齐）
    const movingHEdges = [
      { pos: movingBounds.top, offset: 0 },
      { pos: movingBounds.bottom, offset: movingBounds.bottom - movingBounds.top },
      { pos: movingBounds.centerY, offset: movingBounds.centerY - movingBounds.top }
    ]

    let bestHDist = Infinity
    for (const edge of movingHEdges) {
      for (const target of hTargets) {
        const dist = Math.abs(edge.pos - target)
        if (dist < this.threshold && dist < bestHDist) {
          bestHDist = dist
          snappedTop = (movingObj.top ?? 0) + (target - edge.pos)
          alignLines.push({
            type: 'horizontal',
            position: target,
            start: 0,
            end: 9999
          })
        }
      }
    }

    // 检测 x 方向吸附（垂直对齐）
    const movingVEdges = [
      { pos: movingBounds.left, offset: 0 },
      { pos: movingBounds.right, offset: movingBounds.right - movingBounds.left },
      { pos: movingBounds.centerX, offset: movingBounds.centerX - movingBounds.left }
    ]

    let bestVDist = Infinity
    for (const edge of movingVEdges) {
      for (const target of vTargets) {
        const dist = Math.abs(edge.pos - target)
        if (dist < this.threshold && dist < bestVDist) {
          bestVDist = dist
          snappedLeft = (movingObj.left ?? 0) + (target - edge.pos)
          alignLines.push({
            type: 'vertical',
            position: target,
            start: 0,
            end: 9999
          })
        }
      }
    }

    return { snappedLeft, snappedTop, alignLines }
  }

  /**
   * 获取对象的边界框
   */
  private getBounds(obj: fabric.FabricObject) {
    const bound = obj.getBoundingRect()
    return {
      left: bound.left,
      top: bound.top,
      right: bound.left + bound.width,
      bottom: bound.top + bound.height,
      centerX: bound.left + bound.width / 2,
      centerY: bound.top + bound.height / 2,
      width: bound.width,
      height: bound.height
    }
  }
}
