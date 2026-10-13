const { contextBridge } = require('electron')
const png = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64'))
const tab = {
  openPath: async () => ({ ok: true, needsPassword: false }),
  getInfo: async () => ({ pageCount: 40, pages: Array.from({ length: 40 }, () => ({ width: 600, height: 800, rotation: 0 })), permissions: { print: true, copy: true, annotate: true, edit: true }, encrypted: false }),
  getOutline: async () => [], historyState: async () => ({ canUndo: false, canRedo: false }),
  renderPage: async () => ({ width: 1, height: 1, png }), renderThumbnail: async () => ({ width: 1, height: 1, png }),
  getTextLines: async () => [], listAnnots: async () => [], isDirty: async () => false
}
contextBridge.exposeInMainWorld('api', {
  startupInfo: async () => ({ launchedWithFile: false, existing: [] }),
  onCloseRequested: () => () => {}, onOpenRequested: () => () => {}, onFullscreenChange: () => () => {},
  openFileDialog: async () => ({ canceled: false, paths: ['D:\\Documents\\Project proposal.pdf'] }),
  createTab: async () => {}, closeTab: async () => {}, forTab: () => tab
})
