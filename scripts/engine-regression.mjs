import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { performance } from 'node:perf_hooks'
import { build } from 'esbuild'
import * as mupdf from 'mupdf'

const output = path.resolve('.verification')
fs.mkdirSync(output, { recursive: true })
await build({ entryPoints: ['src/main/engine-client.ts'], outfile: path.join(output, 'engine-client.mjs'), bundle: true, platform: 'node', format: 'esm', packages: 'external' })
const { createEngineClient } = await import(pathToFileURL(path.join(output, 'engine-client.mjs')).href)
const workerUrl = pathToFileURL(path.resolve('out/main/engine-worker.js'))
const engine = createEngineClient(workerUrl)
const input = path.join(output, 'fixture.pdf')
const saved = path.join(output, 'saved.pdf')
const extracted = path.join(output, 'extracted.pdf')
const encrypted = path.join(output, 'encrypted.pdf')
const doc = new mupdf.PDFDocument()
const font = new mupdf.Font('Helvetica')
const resources = { Font: { F1: doc.addSimpleFont(font) } }
const shapes = Array.from({ length: 4000 }, (_, i) => `${i % 570} ${i % 760} 5 5 re f`).join('\n')
for (let i = 0; i < 4; i++) {
  const page = doc.addPage([0, 0, 600, 800], 0, resources, `0.2 0.4 0.6 rg ${shapes}\n0 g BT /F1 18 Tf 30 40 Td (Page ${i + 1} regression text) Tj ET`)
  doc.insertPage(-1, page)
  page.destroy()
}
const bytes = doc.saveToBuffer('compress')
fs.writeFileSync(input, bytes.asUint8Array())
bytes.destroy(); font.destroy(); doc.destroy()

try {
  assert((await engine.openPath(input)).ok)
  assert.equal((await engine.getInfo()).pageCount, 4)
  const normal = await engine.renderPage(0, 1)
  const cached = await engine.renderPage(0, 1)
  assert.deepEqual(cached, normal, 'repeat render matches cached bitmap')
  const high = await engine.renderPage(0, 8)
  assert(high.width * high.height < 8_020_000, 'screen raster bounded at 800%')
  assert(high.width < 4800, 'screen raster cap applies')
  await assert.rejects(engine.renderPage(0, NaN), /Invalid render scale/)
  await assert.rejects(engine.renderPage(100, 1))
  assert((await engine.getTextLines(0)).some(line => line.text.includes('regression')))
  assert((await engine.search('regression')).length === 4)

  // Timers on the main thread must continue firing during real WASM renders.
  let ticks = 0, last = performance.now(), maxGap = 0
  const timer = setInterval(() => { const now = performance.now(); maxGap = Math.max(maxGap, now - last); last = now; ticks++ }, 10)
  const start = performance.now()
  await Promise.all([0, 1, 2, 3].map(page => engine.renderPage(page, 7.9)))
  const elapsed = performance.now() - start
  clearInterval(timer)
  assert(ticks > 3, `main thread remains responsive (${ticks} ticks during ${elapsed.toFixed(0)} ms)`)

  const annot = await engine.createAnnot(0, { type: 'Square', rect: [20, 20, 80, 80], style: { stroke: [1, 0, 0], fill: null, width: 2, opacity: 1 } })
  assert.equal((await engine.listAnnots(0)).length, 1)
  const withAnnot = await engine.loadPageForPrint(0, 1, true)
  await engine.deleteAnnot(0, annot.id)
  assert.equal((await engine.listAnnots(0)).length, 0)
  const withoutAnnot = await engine.loadPageForPrint(0, 1, true)
  assert.notDeepEqual(withAnnot.png, withoutAnnot.png, 'print reflects annotation deletion')
  await engine.undo(); assert.equal((await engine.listAnnots(0)).length, 1)
  await engine.redo(); assert.equal((await engine.listAnnots(0)).length, 0)
  await engine.renderPage(0, 1)
  await engine.rotatePage(0, 90)
  const rotated = await engine.renderPage(0, 1)
  assert.equal(rotated.width, 800, 'rotation invalidates cached geometry')
  await engine.undo()
  assert.equal((await engine.renderPage(0, 1)).width, 600, 'undo invalidates render cache')
  await engine.deletePage(1)
  assert.equal((await engine.getInfo()).pageCount, 3)
  await engine.undo(); assert.equal((await engine.getInfo()).pageCount, 4)
  await engine.redo(); assert.equal((await engine.getInfo()).pageCount, 3)
  await engine.save(saved, 'none')
  assert.equal(await engine.getIsDirty(), false)
  await engine.openPath(saved)
  assert.equal((await engine.getInfo()).pageCount, 3, 'saved deletion persists')
  await engine.extractPages([0], extracted)
  await engine.duplicatePage(0)
  assert.equal((await engine.getInfo()).pageCount, 4)
  await engine.insertPdf(0, extracted)
  assert.equal((await engine.getInfo()).pageCount, 5)
  await engine.reorderPages([4, 3, 2, 1, 0])
  await engine.save(encrypted, { userPassword: 'regression-only' })
  assert.equal((await engine.openPath(encrypted)).needsPassword, true)
  assert.equal(await engine.authenticate('wrong'), false)
  assert.equal(await engine.authenticate('regression-only'), true)
  assert.equal((await engine.getInfo()).pageCount, 5)
  assert((await engine.renderPage(0, 1)).png.length > 0)

  const other = createEngineClient(workerUrl)
  try {
    await other.openPath(extracted)
    assert.equal((await other.getInfo()).pageCount, 1, 'separate tabs own separate documents')
    assert.equal((await engine.getInfo()).pageCount, 5)
  } finally { await other.close() }
  fs.writeFileSync(path.join(output, 'worker-profile.json'), JSON.stringify({ elapsedMs: Math.round(elapsed), timerTicks: ticks, maxTimerGapMs: Math.round(maxGap), maxScreenPixels: high.width * high.height }, null, 2))
  console.log(`PASS: real worker renders, main-thread responsiveness (${ticks} ticks, max gap ${maxGap.toFixed(0)}ms), raster bounds, invalid requests, text/search, annotations, delete/undo/redo, cache invalidation, save/reopen, extract/merge/reorder, encryption, tab isolation`)
} finally { await engine.close() }
await assert.rejects(engine.getInfo(), /closed|stopped/)
