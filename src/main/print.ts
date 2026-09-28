import { BrowserWindow } from 'electron'
import type { EngineSession } from './engine'

export interface PrintOptions {
  pages: 'all' | 'current' | string // "1-3,5"
  includeAnnots: boolean
  currentPage: number
}

export function parseRange(spec: string, pageCount: number): number[] {
  const out = new Set<number>()
  for (const part of spec.split(',')) {
    const trimmed = part.trim()
    if (!trimmed) continue
    const m = trimmed.match(/^(\d+)(?:-(\d+))?$/)
    if (!m) continue
    const start = Math.max(1, parseInt(m[1], 10))
    const end = m[2] ? Math.min(pageCount, parseInt(m[2], 10)) : start
    for (let i = start; i <= end; i++) out.add(i - 1)
  }
  return [...out].sort((a, b) => a - b)
}

export async function printDocument(parent: BrowserWindow, engine: EngineSession, opts: PrintOptions): Promise<void> {
  const info = engine.getInfo()
  let indices: number[]
  if (opts.pages === 'all') indices = info.pages.map((_, i) => i)
  else if (opts.pages === 'current') indices = [opts.currentPage]
  else indices = parseRange(opts.pages, info.pageCount)
  if (indices.length === 0) indices = [opts.currentPage]

  const DPI_SCALE = 300 / 72
  const imgs: { dataUrl: string; w: number; h: number }[] = []
  for (const idx of indices) {
    const page = engine.loadPageForPrint(idx, DPI_SCALE, opts.includeAnnots)
    imgs.push({ dataUrl: `data:image/png;base64,${page.png.toString('base64')}`, w: page.width, h: page.height })
  }

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    * { margin:0; padding:0; }
    .sheet { page-break-after: always; display:flex; align-items:center; justify-content:center; }
    .sheet:last-child { page-break-after: auto; }
    img { width:100%; height:100%; display:block; }
    @page { margin: 0; }
  </style></head><body>
    ${imgs.map((im) => `<div class="sheet"><img src="${im.dataUrl}" /></div>`).join('')}
  </body></html>`

  const printWin = new BrowserWindow({ show: false, parent, webPreferences: { sandbox: true } })
  try {
    await printWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
    await new Promise<void>((resolve, reject) => {
      printWin.webContents.print({ silent: false, printBackground: true }, (ok, errorType) => {
        if (ok) resolve()
        else reject(new Error(errorType))
      })
    })
  } finally {
    printWin.destroy()
  }
}
