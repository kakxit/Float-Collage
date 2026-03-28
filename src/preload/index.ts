import { contextBridge, ipcRenderer } from 'electron'

// 暴露安全的 API 给渲染进程
const electronAPI = {
  // 窗口控制
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  setSize: (width: number, height: number) =>
    ipcRenderer.send('window-set-size', { width, height }),
  setAspectRatio: (ratio: number) => ipcRenderer.send('window-set-aspect-ratio', ratio),
  clearAspectRatio: () => ipcRenderer.send('window-clear-aspect-ratio'),
  getWindowSize: () => ipcRenderer.invoke('get-window-size'),

  // 鼠标穿透
  setIgnoreMouseEvents: (ignore: boolean, options?: { forward: boolean }) =>
    ipcRenderer.send('set-ignore-mouse-events', ignore, options),

  // 始终置顶
  setAlwaysOnTop: (value: boolean) => ipcRenderer.send('window-set-always-on-top', value),
  getAlwaysOnTop: () => ipcRenderer.invoke('get-window-always-on-top'),

  // 文件操作
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  readDroppedFiles: (filePaths: string[]) =>
    ipcRenderer.invoke('read-dropped-files', filePaths),
  saveFileDialog: (ext: string) => ipcRenderer.invoke('save-file-dialog', ext),
  writeExportFile: (filePath: string, base64Data: string) =>
    ipcRenderer.invoke('write-export-file', filePath, base64Data),

  // 事件监听
  onWindowResized: (callback: (data: { width: number; height: number }) => void) => {
    ipcRenderer.on('window-resized', (_event, data) => callback(data))
    return () => ipcRenderer.removeAllListeners('window-resized')
  }
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)

// 类型声明
export type ElectronAPI = typeof electronAPI
