import { app, BrowserWindow, ipcMain, screen, globalShortcut, dialog } from 'electron'
import { join, isAbsolute } from 'path'
import { fileURLToPath } from 'url'
import { readFile } from 'fs/promises'

// 默认窗口尺寸
const DEFAULT_WIDTH = 1270
const DEFAULT_HEIGHT = 960

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize

  // 如果默认尺寸超出屏幕，按比例缩放
  let winWidth = DEFAULT_WIDTH
  let winHeight = DEFAULT_HEIGHT
  const maxWidth = Math.floor(screenWidth * 0.9)
  const maxHeight = Math.floor(screenHeight * 0.9)

  if (winWidth > maxWidth || winHeight > maxHeight) {
    const scale = Math.min(maxWidth / winWidth, maxHeight / winHeight)
    winWidth = Math.floor(winWidth * scale)
    winHeight = Math.floor(winHeight * scale)
  }

  mainWindow = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    frame: false,            // 无边框
    transparent: true,       // 透明窗口
    hasShadow: false,        // 移除阴影
    alwaysOnTop: true,       // 始终置顶
    backgroundColor: '#00000000',
    resizable: true,
    minWidth: 400,
    minHeight: 300,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.center()

  // 开发环境加载 dev server，生产环境加载构建产物
  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // 开发环境打开 DevTools
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  }

  // 窗口尺寸变化时通知渲染进程
  mainWindow.on('resize', () => {
    if (mainWindow) {
      const [width, height] = mainWindow.getContentSize()
      mainWindow.webContents.send('window-resized', { width, height })
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// ========================================
// IPC 事件处理
// ========================================

// 窗口控制
ipcMain.on('window-minimize', () => mainWindow?.minimize())
ipcMain.on('window-maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize()
  } else {
    mainWindow?.maximize()
  }
})
ipcMain.on('window-close', () => mainWindow?.close())

// 设置窗口尺寸（用于预设比例）
ipcMain.on('window-set-size', (_event, data: { width: number; height: number }) => {
  if (mainWindow) {
    mainWindow.setSize(data.width, data.height)
    mainWindow.center()
  }
})

// 设置窗口比例锁定
ipcMain.on('window-set-aspect-ratio', (_event, ratio: number) => {
  if (mainWindow) {
    mainWindow.setAspectRatio(ratio)
  }
})

// 清除比例锁定
ipcMain.on('window-clear-aspect-ratio', () => {
  if (mainWindow) {
    mainWindow.setAspectRatio(0)
  }
})

// 鼠标穿透控制
ipcMain.on('set-ignore-mouse-events', (_event, ignore: boolean, options?: { forward: boolean }) => {
  if (mainWindow) {
    mainWindow.setIgnoreMouseEvents(ignore, options)
  }
})

// 始终置顶控制
ipcMain.on('window-set-always-on-top', (_event, value: boolean) => {
  if (mainWindow) {
    mainWindow.setAlwaysOnTop(value)
  }
})

// 获取置顶状态
ipcMain.handle('get-window-always-on-top', () => {
  return mainWindow?.isAlwaysOnTop() ?? false
})

// 获取窗口尺寸
ipcMain.handle('get-window-size', () => {
  if (mainWindow) {
    const [width, height] = mainWindow.getContentSize()
    return { width, height }
  }
  return { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT }
})

// 打开文件对话框
ipcMain.handle('open-file-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openFile', 'multiSelections'],
    filters: [
      {
        name: 'Images',
        extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif', 'svg']
      }
    ]
  })
  if (result.canceled) return []

  // 读取文件内容并转为 base64
  const files = await Promise.all(
    result.filePaths.map(async (filePath) => {
      const buffer = await readFile(filePath)
      const ext = filePath.split('.').pop()?.toLowerCase() || 'png'
      const mimeMap: Record<string, string> = {
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        webp: 'image/webp',
        bmp: 'image/bmp',
        gif: 'image/gif',
        svg: 'image/svg+xml'
      }
      const mime = mimeMap[ext] || 'image/png'
      const base64 = buffer.toString('base64')
      return {
        name: filePath.split(/[\\/]/).pop() || 'unknown',
        dataUrl: `data:${mime};base64,${base64}`
      }
    })
  )
  return files
})

// 读取拖入的文件
ipcMain.handle('read-dropped-files', async (_event, filePaths: string[]) => {
  const supportedExts = ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif', 'svg']

  const normalizedPaths = filePaths
    .map((fp) => {
      if (!fp) return ''
      if (isAbsolute(fp)) return fp
      if (fp.startsWith('file://')) {
        try {
          return fileURLToPath(fp)
        } catch {
          return ''
        }
      }
      return ''
    })
    .filter((fp): fp is string => Boolean(fp))

  console.debug('[read-dropped-files] incoming paths', {
    incoming: filePaths.length,
    normalized: normalizedPaths.length
  })

  const settled = await Promise.allSettled(
    normalizedPaths
      .filter((fp) => {
        const ext = fp.split('.').pop()?.toLowerCase() || ''
        return supportedExts.includes(ext)
      })
      .map(async (filePath) => {
        const buffer = await readFile(filePath)
        const ext = filePath.split('.').pop()?.toLowerCase() || 'png'
        const mimeMap: Record<string, string> = {
          png: 'image/png',
          jpg: 'image/jpeg',
          jpeg: 'image/jpeg',
          webp: 'image/webp',
          bmp: 'image/bmp',
          gif: 'image/gif',
          svg: 'image/svg+xml'
        }
        const mime = mimeMap[ext] || 'image/png'
        const base64 = buffer.toString('base64')
        return {
          name: filePath.split(/[\\/]/).pop() || 'unknown',
          dataUrl: `data:${mime};base64,${base64}`
        }
      })
  )

  const rejected = settled.filter((item) => item.status === 'rejected').length
  if (rejected > 0) {
    console.warn('[read-dropped-files] rejected file reads', { rejected })
  }


  return settled
    .filter((item): item is PromiseFulfilledResult<{ name: string; dataUrl: string }> => item.status === 'fulfilled')
    .map((item) => item.value)
})

// 保存导出文件对话框
ipcMain.handle('save-file-dialog', async (_event, defaultExt: string) => {
  const filters: Record<string, Electron.FileFilter> = {
    png: { name: 'PNG Image', extensions: ['png'] },
    jpg: { name: 'JPEG Image', extensions: ['jpg', 'jpeg'] },
    webp: { name: 'WebP Image', extensions: ['webp'] }
  }
  const result = await dialog.showSaveDialog(mainWindow!, {
    defaultPath: `freepn-export.${defaultExt}`,
    filters: [filters[defaultExt] || filters.png]
  })
  return result.canceled ? null : result.filePath
})

// 写入导出文件
ipcMain.handle('write-export-file', async (_event, filePath: string, base64Data: string) => {
  const { writeFile } = await import('fs/promises')
  const buffer = Buffer.from(base64Data, 'base64')
  await writeFile(filePath, buffer)
  return true
})

// ========================================
// 应用生命周期
// ========================================

app.whenReady().then(() => {
  createWindow()
})

app.on('window-all-closed', () => {
  app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})
