const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
app.whenReady().then(async () => {
  const output = path.join(__dirname, '../.verification')
  fs.mkdirSync(output, { recursive: true })
  const win = new BrowserWindow({ show: false, width: 1280, height: 900, webPreferences: { preload: path.join(__dirname, 'ui-smoke-preload.cjs'), sandbox: false }, })
  const js = (source) => win.webContents.executeJavaScript(source)
  const settle = () => new Promise(resolve => setTimeout(resolve, 500))
  let failed = false
  try {
    await win.loadFile(path.join(__dirname, '../out/renderer/index.html'))
    await settle()
    await js('localStorage.clear()')
    await win.reload(); await settle()
    assert(await js('!!document.querySelector(".landing-hero")'), 'landing rendered')
    assert(await js('document.fonts.load("400 14px Pretendard").then(fonts => fonts.length > 0 && fonts.every(font => font.status === "loaded"))'), 'bundled Pretendard loads')
    fs.writeFileSync(path.join(output, 'landing.png'), (await win.webContents.capturePage()).toPNG())
    await js('window.dispatchEvent(new KeyboardEvent("keydown", { key: "o", ctrlKey: true }))')
    await settle()
    assert(await js('!!document.querySelector(".viewer")'), 'Ctrl+O opens a document from landing')
    const width = await js('document.querySelector(".page").getBoundingClientRect().width')
    assert(width > 950, `width fit uses mounted viewer dimensions: ${width}`)
    await js('const input = document.querySelector(".page-input"); input.value = "30"; input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }))')
    await settle()
    assert(await js('!!document.querySelector(".page[data-page=" + JSON.stringify("29") + "]")'), 'jump mounts page 30 outside virtualized range')
    assert(await js('document.querySelector(".viewer").scrollTop > 20000'), 'jump scrolls to page 30')
    win.setSize(1000, 800); await settle()
    const resized = await js('document.querySelector(".page").getBoundingClientRect().width')
    assert(resized < width - 200, 'width fit follows window resize')
    assert(await js('document.querySelector(".zoom-indicator").textContent !== "100%"'), 'toolbar shows effective zoom')
    await js('window.testMetrics.reset()')
    const anchorBefore = await js('document.querySelector(".page-input").value')
    await js(`(async () => {
      for (let i = 0; i < 20; i++) {
        document.querySelector('.viewer').dispatchEvent(new WheelEvent('wheel', {ctrlKey:true, deltaY: i < 10 ? -1 : 1, bubbles:true, cancelable:true}));
        await new Promise(r => setTimeout(r, 16));
      }
    })()`)
    await settle()
    const calls = await js('window.testMetrics.calls()')
    assert(calls.length <= 3, `20 zoom inputs coalesce to visible pages only: ${JSON.stringify(calls)}`)
    assert(calls.length > 0, 'final zoom is rendered')
    assert.equal(await js('document.querySelector(".page-input").value'), anchorBefore, 'zoom keeps current page')
    assert(await js(`(() => {
      const el = document.querySelector('.text-layer span');
      const page = el.closest('.page').getBoundingClientRect();
      const rect = el.getBoundingClientRect();
      const scale = page.width / 600;
      return Math.abs(rect.left - page.left - 10 * scale) < 2 && Math.abs(rect.width - 200 * scale) < 2;
    })()`), 'text selection geometry tracks zoom')
    await js('window.testMetrics.reset(); window.testMetrics.delay(350)')
    await js('document.querySelector("button[title=확대]").click()')
    await new Promise(r => setTimeout(r, 160))
    await js('document.querySelector("button[title=확대]").click()')
    await new Promise(r => setTimeout(r, 160))
    await js('document.querySelector("button[title=확대]").click()')
    await new Promise(r => setTimeout(r, 1100))
    const slowCalls = await js('window.testMetrics.calls()')
    assert(slowCalls.length <= 4, 'slow engine skips superseded queued scales')
    await js('window.testMetrics.delay(0); window.testMetrics.fail(true); document.querySelector("button[title=축소]").click()')
    await settle()
    assert(await js('document.body.textContent.includes("페이지 렌더링에 실패했습니다")'), 'render failure is reported')
    await js('window.testMetrics.fail(false); document.querySelector("button[title=축소]").click()')
    await settle()
    await js('document.querySelector(".header-search").click()'); await settle()
    assert(await js('!!document.querySelector(".search-bar")'), 'header search opens')
    win.setSize(1280, 900); await settle()
    fs.writeFileSync(path.join(output, 'workspace.png'), (await win.webContents.capturePage()).toPNG())
    console.log(`PASS: landing, navigation, resize fit, zoom coalescing (${calls.length} renders / 20 inputs), slow render queue, zoom anchor, text geometry, render failure recovery, search`)
  } catch (error) { console.error(error); failed = true }
  win.destroy(); app.exit(failed ? 1 : 0)
})
