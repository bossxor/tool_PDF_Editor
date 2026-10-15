// Local-only profiling: PDF contents and names are never sent anywhere.
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { performance } from 'node:perf_hooks'
const { EngineSession } = await import(pathToFileURL(path.resolve(process.argv[2] || '.verification/baseline-engine.mjs')).href)
const input = process.argv[3] || fs.readdirSync('.').find(p => p.endsWith('.pdf'))
if (!input) throw new Error('Pass a local PDF path')
const engine = new EngineSession()
await engine.openPath(input)
const pages = engine.getInfo().pageCount
const samples = []
for (const scale of [1, 1.1, 1.2, 1.3, 1.4, 1.5, 2, 4, 8]) {
  await engine.openPath(input) // Cold render at every scale; do not count a cache hit as raster speed.
  const start = performance.now()
  let maxPixels = 0
  for (let page = 0; page < Math.min(4, pages); page++) {
    const r = engine.renderPage(page, scale)
    maxPixels = Math.max(maxPixels, r.width * r.height)
  }
  samples.push({ scale, pages: Math.min(4, pages), ms: Math.round(performance.now() - start), maxPixels })
}
engine.close()
console.log(JSON.stringify({ pages, samples }, null, 2))
