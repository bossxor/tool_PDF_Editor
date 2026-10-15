// Run the actual main/preload/renderer together, with isolated settings and a
// generated fixture. PDF_EDITOR_APP_ROOT can point into the packaged ASAR.
const { app, BrowserWindow } = require('electron')
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const assert = require('node:assert/strict')
const root = path.resolve(__dirname, '..')
app.setPath('userData', path.join(root, `.verification/app-smoke-profile-${process.pid}`))
BrowserWindow.prototype.show = function () {} // Test window stays hidden.
const timeout = setTimeout(() => { console.error('App smoke timeout'); app.exit(1) }, 30000)
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
app.on('browser-window-created', (_event, win) => {
  win.webContents.once('did-finish-load', async () => {
    try {
      const fixture = path.join(root, '.verification/fixture.pdf')
      await win.webContents.executeJavaScript(`Object.defineProperty(crypto, 'randomUUID', {value: () => 'smoke-ui'})`)
      win.webContents.send('open-requested', fixture)
      for (let i = 0; i < 100; i++) {
        if (await win.webContents.executeJavaScript('!!document.querySelector(".page img")')) break
        await wait(100)
      }
      assert(await win.webContents.executeJavaScript('!!document.querySelector(".page img")'), 'real PDF paints through IPC and worker')
      assert(await win.webContents.executeJavaScript('document.querySelector(".text-layer").textContent.includes("regression")'), 'real text layer')
      await win.webContents.executeJavaScript('document.querySelector("button[title=확대]").click()')
      await wait(500)
      const result = await win.webContents.executeJavaScript(`(async () => {
        await window.api.createTab('regression-ipc');
        const api = window.api.forTab('regression-ipc');
        const opened = await api.openPath(${JSON.stringify(fixture)});
        await api.deletePage(1);
        const deleted = await api.getInfo();
        await api.undo();
        const restored = await api.getInfo();
        await window.api.closeTab('regression-ipc');
        return {opened,deleted:deleted.pageCount,restored:restored.pageCount};
      })()`)
      assert(result.opened.ok); assert.equal(result.deleted, 3); assert.equal(result.restored, 4)
      await win.webContents.executeJavaScript(`window.api.forTab('smoke-ui').createAnnot(0, {type:'Square',rect:[20,20,80,80],style:{stroke:[1,0,0],fill:null,width:2,opacity:1}})`)
      win.close()
      await wait(300)
      assert(await win.webContents.executeJavaScript('!!document.querySelector(".modal.confirm")'), 'dirty close prompts after asynchronous engine check')
      await win.webContents.executeJavaScript(`Array.from(document.querySelectorAll('.modal-actions button')).find(b => b.textContent === '취소').click()`)
      await wait(100)
      assert(!win.isDestroyed(), 'cancel keeps window open')
      win.once('closed', () => {
        console.log('PASS: real app main/preload/renderer, worker/WASM, bitmap/text, zoom, IPC delete/undo/close, dirty quit/cancel/discard')
        clearTimeout(timeout); app.exit(0)
      })
      win.close(); await wait(300)
      await win.webContents.executeJavaScript(`Array.from(document.querySelectorAll('.modal-actions button')).find(b => b.textContent === '저장 안 함').click()`)
    } catch (error) { console.error(error); clearTimeout(timeout); app.exit(1) }
  })
})
import(pathToFileURL(path.join(process.env.PDF_EDITOR_APP_ROOT || root, 'out/main/index.js')).href).catch(error => { console.error(error); app.exit(1) })
