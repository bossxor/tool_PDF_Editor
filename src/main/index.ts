import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import { join } from 'node:path'
import { EngineSession } from './engine'
import { parseRange, printDocument } from './print'

let mainWindow: BrowserWindow | null = null
let pendingOpenPaths: string[] = []
const sessions = new Map<string, EngineSession>()

function isDev(): boolean {
  return !!process.env['ELECTRON_RENDERER_URL']
}

function getSession(tabId: string): EngineSession {
  const s = sessions.get(tabId)
  if (!s) throw new Error('Unknown tab: ' + tabId)
  return s
}

function anyDirty(): boolean {
  return [...sessions.values()].some((s) => s.getIsDirty())
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    show: false,
    autoHideMenuBar: true,
    icon: isDev() ? join(__dirname, '../../build/icon.png') : undefined,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (process.env['PDF_EDITOR_DEBUG']) {
    mainWindow.webContents.on('console-message', (_e, level, message) => {
      console.log('[renderer]', level, message)
    })
  }

  mainWindow.on('enter-full-screen', () => mainWindow?.webContents.send('fullscreen-changed', true))
  mainWindow.on('leave-full-screen', () => mainWindow?.webContents.send('fullscreen-changed', false))

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
    if (pendingOpenPaths.length > 0) {
      for (const p of pendingOpenPaths) mainWindow?.webContents.send('open-requested', p)
      pendingOpenPaths = []
    }
  })

  mainWindow.on('close', (e) => {
    if (anyDirty()) {
      const choice = dialog.showMessageBoxSync(mainWindow!, {
        type: 'question',
        buttons: ['종료', '취소'],
        defaultId: 1,
        cancelId: 1,
        message: '저장하지 않은 변경 사항이 있습니다. 그래도 종료하시겠습니까?'
      })
      if (choice === 1) e.preventDefault()
    }
  })

  if (isDev()) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']!)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function registerIpc(): void {
  ipcMain.handle('tab:create', async (_e, tabId: string) => {
    sessions.set(tabId, new EngineSession())
  })
  ipcMain.handle('tab:close', async (_e, tabId: string) => {
    sessions.get(tabId)?.close()
    sessions.delete(tabId)
  })

  ipcMain.handle('file:open-dialog', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    })
    if (result.canceled || result.filePaths.length === 0) return { canceled: true, paths: [] }
    return { canceled: false, paths: result.filePaths }
  })

  ipcMain.handle('file:open-path', async (_e, tabId: string, p: string) => getSession(tabId).openPath(p))
  ipcMain.handle('doc:authenticate', async (_e, tabId: string, pw: string) => getSession(tabId).authenticate(pw))
  ipcMain.handle('doc:info', async (_e, tabId: string) => getSession(tabId).getInfo())
  ipcMain.handle('doc:outline', async (_e, tabId: string) => getSession(tabId).getOutline())
  ipcMain.handle('doc:isDirty', async (_e, tabId: string) => getSession(tabId).getIsDirty())

  ipcMain.handle('render:page', async (_e, tabId: string, page: number, scale: number) => {
    const r = getSession(tabId).renderPage(page, scale)
    return { width: r.width, height: r.height, png: r.png.buffer.slice(r.png.byteOffset, r.png.byteOffset + r.png.byteLength) }
  })
  ipcMain.handle('render:thumbnail', async (_e, tabId: string, page: number, width: number) => {
    const r = getSession(tabId).renderThumbnail(page, width)
    return { width: r.width, height: r.height, png: r.png.buffer.slice(r.png.byteOffset, r.png.byteOffset + r.png.byteLength) }
  })

  ipcMain.handle('text:lines', async (_e, tabId: string, page: number) => getSession(tabId).getTextLines(page))
  ipcMain.handle('text:search', async (_e, tabId: string, query: string) => getSession(tabId).search(query))
  ipcMain.handle(
    'text:highlightQuads',
    async (_e, tabId: string, page: number, p: [number, number], q: [number, number]) =>
      getSession(tabId).highlightQuads(page, p, q)
  )

  ipcMain.handle('annot:list', async (_e, tabId: string, page: number) => getSession(tabId).listAnnots(page))
  ipcMain.handle('annot:create', async (_e, tabId: string, page: number, data: any) =>
    getSession(tabId).createAnnot(page, data)
  )
  ipcMain.handle('annot:update', async (_e, tabId: string, page: number, id: string, patch: any) =>
    getSession(tabId).updateAnnot(page, id, patch)
  )
  ipcMain.handle('annot:delete', async (_e, tabId: string, page: number, id: string) =>
    getSession(tabId).deleteAnnot(page, id)
  )

  ipcMain.handle('history:undo', async (_e, tabId: string) => getSession(tabId).undo())
  ipcMain.handle('history:redo', async (_e, tabId: string) => getSession(tabId).redo())
  ipcMain.handle('history:state', async (_e, tabId: string) => getSession(tabId).historyState())

  ipcMain.handle('page:rotate', async (_e, tabId: string, page: number, delta: 90 | -90 | 180) =>
    getSession(tabId).rotatePage(page, delta)
  )
  ipcMain.handle('page:delete', async (_e, tabId: string, page: number) => getSession(tabId).deletePage(page))
  ipcMain.handle('page:reorder', async (_e, tabId: string, order: number[]) => getSession(tabId).reorderPages(order))
  ipcMain.handle('page:duplicate', async (_e, tabId: string, page: number) => getSession(tabId).duplicatePage(page))

  ipcMain.handle('page:insertPdf', async (_e, tabId: string, after: number) => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: '삽입할 PDF 선택',
      properties: ['openFile'],
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    })
    if (result.canceled || result.filePaths.length === 0) return { ok: false }
    try {
      return { ok: true, count: getSession(tabId).insertPdf(after, result.filePaths[0]) }
    } catch (e) {
      return { ok: false, error: String((e as Error)?.message ?? e) }
    }
  })
  ipcMain.handle('page:extract', async (_e, tabId: string, range: string) => {
    const session = getSession(tabId)
    const indices = parseRange(range, session.getInfo().pageCount)
    if (indices.length === 0) return { ok: false, error: '페이지 범위가 올바르지 않습니다.' }
    const base = (session.getFilePath() ?? 'document.pdf').replace(/\.pdf$/i, '')
    const result = await dialog.showSaveDialog(mainWindow!, {
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
      defaultPath: `${base}_p${range.replace(/[^0-9,-]/g, '')}.pdf`
    })
    if (result.canceled || !result.filePath) return { ok: false }
    try {
      session.extractPages(indices, result.filePath)
      return { ok: true, path: result.filePath }
    } catch (e) {
      return { ok: false, error: String((e as Error)?.message ?? e) }
    }
  })

  ipcMain.handle('doc:save', async (_e, tabId: string, opts: any) => {
    const session = getSession(tabId)
    const path = session.getFilePath()
    if (!path) return { ok: false }
    await session.save(path, opts.encryption)
    return { ok: true, path }
  })

  ipcMain.handle('doc:saveAs', async (_e, tabId: string, opts: any) => {
    const session = getSession(tabId)
    const result = await dialog.showSaveDialog(mainWindow!, {
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
      defaultPath: session.getFilePath() ?? 'document.pdf'
    })
    if (result.canceled || !result.filePath) return { ok: false }
    await session.save(result.filePath, opts.encryption)
    return { ok: true, path: result.filePath }
  })

  ipcMain.handle(
    'doc:print',
    async (_e, tabId: string, opts: { pages: string; includeAnnots: boolean; currentPage: number }) => {
      await printDocument(mainWindow!, getSession(tabId), opts)
    }
  )

  ipcMain.handle('window:toggleFullscreen', () => {
    const next = !mainWindow!.isFullScreen()
    mainWindow!.setFullScreen(next)
    return next
  })
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', (_e, argv) => {
    const paths = argv.filter((a) => a.toLowerCase().endsWith('.pdf'))
    for (const p of paths) mainWindow?.webContents.send('open-requested', p)
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(() => {
    registerIpc()
    pendingOpenPaths = process.argv.filter((a) => a.toLowerCase().endsWith('.pdf'))
    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  app.on('web-contents-created', (_e, contents) => {
    contents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url)
      return { action: 'deny' }
    })
  })
}
