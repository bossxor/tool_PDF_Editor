import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { PdfApi, TabApi } from '../shared/types'

function forTab(tabId: string): TabApi {
  return {
    openPath: (path) => ipcRenderer.invoke('file:open-path', tabId, path),
    authenticate: (password) => ipcRenderer.invoke('doc:authenticate', tabId, password),
    getInfo: () => ipcRenderer.invoke('doc:info', tabId),
    getOutline: () => ipcRenderer.invoke('doc:outline', tabId),

    renderPage: (page, scale) => ipcRenderer.invoke('render:page', tabId, page, scale),
    renderThumbnail: (page, width) => ipcRenderer.invoke('render:thumbnail', tabId, page, width),

    getTextLines: (page) => ipcRenderer.invoke('text:lines', tabId, page),
    search: (query) => ipcRenderer.invoke('text:search', tabId, query),
    highlightQuads: (page, p, q) => ipcRenderer.invoke('text:highlightQuads', tabId, page, p, q),

    listAnnots: (page) => ipcRenderer.invoke('annot:list', tabId, page),
    createAnnot: (page, data) => ipcRenderer.invoke('annot:create', tabId, page, data),
    updateAnnot: (page, id, patch) => ipcRenderer.invoke('annot:update', tabId, page, id, patch),
    deleteAnnot: (page, id) => ipcRenderer.invoke('annot:delete', tabId, page, id),

    undo: () => ipcRenderer.invoke('history:undo', tabId),
    redo: () => ipcRenderer.invoke('history:redo', tabId),
    historyState: () => ipcRenderer.invoke('history:state', tabId),

    rotatePage: (page, delta) => ipcRenderer.invoke('page:rotate', tabId, page, delta),
    deletePage: (page) => ipcRenderer.invoke('page:delete', tabId, page),
    reorderPages: (order) => ipcRenderer.invoke('page:reorder', tabId, order),
    duplicatePage: (page) => ipcRenderer.invoke('page:duplicate', tabId, page),
    insertPdf: (after) => ipcRenderer.invoke('page:insertPdf', tabId, after),
    extractPages: (range) => ipcRenderer.invoke('page:extract', tabId, range),

    save: (opts) => ipcRenderer.invoke('doc:save', tabId, opts),
    saveAs: (opts) => ipcRenderer.invoke('doc:saveAs', tabId, opts),

    isDirty: () => ipcRenderer.invoke('doc:isDirty', tabId),

    print: (opts) => ipcRenderer.invoke('doc:print', tabId, opts)
  }
}

const api: PdfApi = {
  openFileDialog: () => ipcRenderer.invoke('file:open-dialog'),
  createTab: (tabId) => ipcRenderer.invoke('tab:create', tabId),
  closeTab: (tabId) => ipcRenderer.invoke('tab:close', tabId),
  forTab,
  onOpenRequested: (cb) => {
    ipcRenderer.on('open-requested', (_e, path: string) => cb(path))
  },
  getPathForFile: (file) => webUtils.getPathForFile(file),
  toggleFullscreen: () => ipcRenderer.invoke('window:toggleFullscreen'),
  onFullscreenChange: (cb) => {
    ipcRenderer.on('fullscreen-changed', (_e, v: boolean) => cb(v))
  }
}

contextBridge.exposeInMainWorld('api', api)
