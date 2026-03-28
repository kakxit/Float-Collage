// Electron API 类型声明
export interface ElectronAPI {
  minimize: () => void
  maximize: () => void
  close: () => void
  setSize: (width: number, height: number) => void
  setAspectRatio: (ratio: number) => void
  clearAspectRatio: () => void
  getWindowSize: () => Promise<{ width: number; height: number }>
  setIgnoreMouseEvents: (ignore: boolean, options?: { forward: boolean }) => void
  setAlwaysOnTop: (value: boolean) => void
  getAlwaysOnTop: () => Promise<boolean>
  openFileDialog: () => Promise<ImportedFile[]>
  readDroppedFiles: (filePaths: string[]) => Promise<ImportedFile[]>
  saveFileDialog: (ext: string) => Promise<string | null>
  writeExportFile: (filePath: string, base64Data: string) => Promise<boolean>
  onWindowResized: (callback: (data: { width: number; height: number }) => void) => () => void
}

// 导入的文件
export interface ImportedFile {
  name: string
  dataUrl: string
}

// 参考线
export interface GuideLine {
  id: string
  type: 'horizontal' | 'vertical'
  position: number // 像素位置
}

// 画布上的图片对象
export interface CanvasImage {
  id: string
  name: string
  fabricObjectIndex: number
  visible: boolean
  locked: boolean
}

// 预设比例
export interface AspectRatioPreset {
  label: string
  ratio: number // width / height
  width: number
  height: number
}

// 全局 Window 类型扩展
declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
