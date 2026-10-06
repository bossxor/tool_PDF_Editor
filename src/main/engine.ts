// MuPDF wrapper. Runs in the Electron main process (Node context), so it can
// read the wasm file straight off disk the same way our verified test did.
// One EngineSession = one open document. Multiple sessions (one per UI tab)
// can be alive at once; main/index.ts keeps a Map<tabId, EngineSession>.

import * as mupdf from 'mupdf'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import type {
  AnnotData,
  AnnotStyle,
  AnnotType,
  DocInfo,
  HistoryState,
  NewAnnotInput,
  OpenResult,
  OutlineItem,
  SaveOptions,
  SearchHit,
  TextLine
} from '../shared/types'

type Quad8 = [number, number, number, number, number, number, number, number]

function safeColor(fn: () => number[]): AnnotStyle['stroke'] {
  try {
    const c = fn()
    if (!c || c.length === 0) return null
    if (c.length === 1) return [c[0], c[0], c[0]]
    if (c.length >= 3) return [c[0], c[1], c[2]]
    return null
  } catch {
    return null
  }
}

// FreeText has no separate "interior color" concept in PDF — its /C entry
// IS the background, so style.fill (not style.stroke) has to go through
// setColor for that type. Every color is always written (never skipped),
// converting "없음"(null) to an empty array, which is MuPDF's own way of
// saying "no color" — skipping the call on null left old colors in place.
function applyStyle(annot: mupdf.PDFAnnotation, type: AnnotType, style: AnnotStyle): void {
  if (type === 'FreeText') {
    annot.setColor(style.fill ?? [])
  } else {
    annot.setColor(style.stroke ?? [])
    if (annot.hasInteriorColor()) annot.setInteriorColor(style.fill ?? [])
  }
  if (annot.hasBorder()) annot.setBorderWidth(style.width)
  annot.setOpacity(style.opacity)
}

function computeFallbackRect(annot: mupdf.PDFAnnotation): [number, number, number, number] {
  if (annot.hasInkList()) {
    const strokes = annot.getInkList()
    const xs = strokes.flatMap((s) => s.map((p) => p[0]))
    const ys = strokes.flatMap((s) => s.map((p) => p[1]))
    if (xs.length > 0) return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]
  }
  if (annot.hasQuadPoints()) {
    const quads = annot.getQuadPoints()
    const xs = quads.flatMap((q) => [q[0], q[2], q[4], q[6]])
    const ys = quads.flatMap((q) => [q[1], q[3], q[5], q[7]])
    if (xs.length > 0) return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]
  }
  return [0, 0, 0, 0]
}

// Annotation types the renderer draws as its own SVG overlay (AnnotLayer).
const OVERLAY_TYPES = new Set(['Highlight', 'Underline', 'StrikeOut', 'Square', 'Circle', 'Line', 'Ink', 'FreeText', 'Text'])

function getRotation(page: mupdf.PDFPage): number {
  const r = page.getObject().getInheritable('Rotate')
  const n = r?.isNumber?.() ? r.asNumber() : 0
  return ((Math.round(n) % 360) + 360) % 360
}

export class EngineSession {
  private doc: mupdf.PDFDocument | null = null
  private password: string | null = null
  private filePath: string | null = null
  private dirty = false

  private requireDoc(): mupdf.PDFDocument {
    if (!this.doc) throw new Error('No document open')
    return this.doc
  }

  getFilePath(): string | null {
    return this.filePath
  }

  getIsDirty(): boolean {
    return this.dirty
  }

  private markDirty(): void {
    this.dirty = true
  }

  close(): void {
    this.doc = null
    this.password = null
    this.filePath = null
    this.dirty = false
  }

  async openPath(p: string): Promise<OpenResult> {
    try {
      const data = fs.readFileSync(p)
      const opened = mupdf.Document.openDocument(data, 'application/pdf')
      const pdf = opened.asPDF()
      if (!pdf) return { ok: false, needsPassword: false, error: 'PDF 문서가 아닙니다.' }
      this.doc = pdf
      this.filePath = p
      this.password = null
      this.dirty = false
      if (pdf.needsPassword()) {
        return { ok: true, needsPassword: true }
      }
      this.doc.enableJournal()
      return { ok: true, needsPassword: false }
    } catch (e) {
      return { ok: false, needsPassword: false, error: String((e as Error)?.message ?? e) }
    }
  }

  authenticate(pw: string): boolean {
    const d = this.requireDoc()
    const level = d.authenticatePassword(pw)
    if (level > 0) {
      this.password = pw
      d.enableJournal()
      return true
    }
    return false
  }

  getInfo(): DocInfo {
    const d = this.requireDoc()
    const count = d.countPages()
    const pages = []
    for (let i = 0; i < count; i++) {
      const page = d.loadPage(i)
      const bounds = page.getBounds()
      pages.push({
        width: bounds[2] - bounds[0],
        height: bounds[3] - bounds[1],
        rotation: getRotation(page)
      })
    }
    return {
      pageCount: count,
      pages,
      encrypted: !!this.password,
      permissions: {
        print: d.hasPermission('print'),
        copy: d.hasPermission('copy'),
        annotate: d.hasPermission('annotate'),
        edit: d.hasPermission('edit')
      },
      title: d.getMetaData(mupdf.Document.META_INFO_TITLE) || undefined
    }
  }

  getOutline(): OutlineItem[] {
    const d = this.requireDoc()
    const outline = d.loadOutline()
    if (!outline) return []
    const convert = (items: any[]): OutlineItem[] =>
      items.map((it) => ({
        title: it.title ?? '',
        page: typeof it.page === 'number' ? it.page : null,
        children: it.down ? convert(it.down) : []
      }))
    return convert(outline)
  }

  // The renderer draws these annotation types itself as an SVG overlay, so the
  // on-screen bitmap must leave them out — otherwise they show up twice, and
  // the baked-in copy goes stale (ghosts at the old spot) after a move/undo
  // until the next re-render. hidden-for-editing is a runtime-only flag; it
  // doesn't touch what gets saved.
  private setOverlayAnnotsHidden(page: mupdf.PDFPage, hidden: boolean): void {
    for (const a of page.getAnnotations()) {
      if (OVERLAY_TYPES.has(a.getType())) a.setHiddenForEditing(hidden)
    }
  }

  renderPage(pageIndex: number, scale: number): { width: number; height: number; png: Buffer } {
    const d = this.requireDoc()
    const page = d.loadPage(pageIndex)
    this.setOverlayAnnotsHidden(page, true)
    const matrix = mupdf.Matrix.scale(scale, scale)
    const pix = page.toPixmap(matrix, mupdf.ColorSpace.DeviceRGB, false, true)
    const png = Buffer.from(pix.asPNG())
    return { width: pix.getWidth(), height: pix.getHeight(), png }
  }

  loadPageForPrint(pageIndex: number, scale: number, includeAnnots: boolean): { width: number; height: number; png: Buffer } {
    const d = this.requireDoc()
    const page = d.loadPage(pageIndex)
    // Print has no SVG overlay — annotations must be baked into the bitmap.
    this.setOverlayAnnotsHidden(page, false)
    const matrix = mupdf.Matrix.scale(scale, scale)
    const pix = page.toPixmap(matrix, mupdf.ColorSpace.DeviceRGB, false, includeAnnots)
    return { width: pix.getWidth(), height: pix.getHeight(), png: Buffer.from(pix.asPNG()) }
  }

  renderThumbnail(pageIndex: number, width: number): { width: number; height: number; png: Buffer } {
    const d = this.requireDoc()
    const page = d.loadPage(pageIndex)
    const bounds = page.getBounds()
    const pageWidth = bounds[2] - bounds[0] || 1
    const scale = width / pageWidth
    return this.renderPage(pageIndex, scale)
  }

  getTextLines(pageIndex: number): TextLine[] {
    const d = this.requireDoc()
    const page = d.loadPage(pageIndex)
    const stext = page.toStructuredText('preserve-whitespace')
    const json = JSON.parse(stext.asJSON())
    const lines: TextLine[] = []
    for (const block of json.blocks ?? []) {
      if (block.type !== 'text') continue
      for (const line of block.lines ?? []) {
        // stext JSON gives bbox as {x,y,w,h}, not a [x0,y0,x1,y1] tuple.
        const b = line.bbox as { x: number; y: number; w: number; h: number }
        const bbox: [number, number, number, number] = [b.x, b.y, b.x + b.w, b.y + b.h]
        const text = (line.text as string) ?? ''
        const fontSize = line.font?.size ?? 10
        if (text.trim().length > 0) lines.push({ bbox, text, fontSize })
      }
    }
    return lines
  }

  highlightQuads(pageIndex: number, p: [number, number], q: [number, number]): Quad8[] {
    const d = this.requireDoc()
    const page = d.loadPage(pageIndex)
    const stext = page.toStructuredText('preserve-whitespace')
    return stext.highlight(p, q) as unknown as Quad8[]
  }

  search(query: string): SearchHit[] {
    const d = this.requireDoc()
    const count = d.countPages()
    const hits: SearchHit[] = []
    for (let i = 0; i < count; i++) {
      const page = d.loadPage(i)
      for (const group of page.search(query, {})) {
        hits.push({ page: i, quads: group as unknown as Quad8[] })
      }
    }
    return hits
  }

  // ---------- Annotations ----------

  private annotToData(page: number, annot: mupdf.PDFAnnotation): AnnotData {
    const type = annot.getType() as AnnotType
    const rect = annot.hasRect() ? annot.getRect() : computeFallbackRect(annot)
    let id = annot.getName()
    if (!id) {
      id = randomUUID()
      annot.setName(id)
    }
    const style: AnnotStyle =
      type === 'FreeText'
        ? {
            stroke: null,
            fill: safeColor(() => annot.getColor()),
            width: annot.hasBorder() ? annot.getBorderWidth() : 0,
            opacity: annot.getOpacity()
          }
        : {
            stroke: safeColor(() => annot.getColor()),
            fill: annot.hasInteriorColor() ? safeColor(() => annot.getInteriorColor()) : null,
            width: annot.hasBorder() ? annot.getBorderWidth() : 0,
            opacity: annot.getOpacity()
          }
    const data: AnnotData = { id, page, type, rect, style }
    if (annot.hasQuadPoints()) data.quads = annot.getQuadPoints() as unknown as Quad8[]
    if (annot.hasLine()) {
      const pts = annot.getLine()
      data.line = [pts[0], pts[1]] as AnnotData['line']
    }
    if (annot.hasInkList()) data.ink = annot.getInkList() as AnnotData['ink']
    if (type === 'FreeText') {
      const da = annot.getDefaultAppearance()
      data.text = {
        content: annot.getContents(),
        font: 'Helv',
        size: da.size || 12,
        color: safeColor(() => da.color),
        align: (annot.getQuadding() as 0 | 1 | 2) ?? 0
      }
    }
    if (type === 'Text') {
      data.contents = annot.getContents()
    }
    return data
  }

  listAnnots(pageIndex: number): AnnotData[] {
    const d = this.requireDoc()
    const page = d.loadPage(pageIndex)
    return page.getAnnotations().map((a) => this.annotToData(pageIndex, a))
  }

  createAnnot(pageIndex: number, input: NewAnnotInput): AnnotData {
    const d = this.requireDoc()
    const page = d.loadPage(pageIndex)
    d.beginOperation(`add-${input.type}`)
    try {
      const annot = page.createAnnotation(input.type as mupdf.PDFAnnotationType)
      if (annot.hasRect()) {
        annot.setRect(input.rect)
      }
      if (input.quads && annot.hasQuadPoints()) {
        annot.setQuadPoints(input.quads as unknown as mupdf.Quad[])
      }
      if (input.line && annot.hasLine()) {
        annot.setLine(input.line[0], input.line[1])
      }
      if (input.ink && annot.hasInkList()) {
        annot.setInkList(input.ink as unknown as mupdf.Point[][])
      }
      if (input.type === 'FreeText' && input.text) {
        annot.setDefaultAppearance('Helv', input.text.size, input.text.color ?? [0, 0, 0])
        annot.setContents(input.text.content)
        annot.setQuadding(input.text.align)
        applyStyle(annot, 'FreeText', input.style)
      } else if (input.type === 'Text') {
        annot.setContents(input.contents ?? '')
        applyStyle(annot, 'Text', input.style)
      } else {
        applyStyle(annot, input.type, input.style)
      }
      const id = randomUUID()
      annot.setName(id)
      annot.update()
      page.update()
      this.markDirty()
      return this.annotToData(pageIndex, annot)
    } finally {
      d.endOperation()
    }
  }

  private findAnnot(pageIndex: number, id: string): { page: mupdf.PDFPage; annot: mupdf.PDFAnnotation } {
    const d = this.requireDoc()
    const page = d.loadPage(pageIndex)
    const annot = page.getAnnotations().find((a) => a.getName() === id)
    if (!annot) throw new Error('Annotation not found: ' + id)
    return { page, annot }
  }

  updateAnnot(pageIndex: number, id: string, patch: Partial<NewAnnotInput>): AnnotData {
    const d = this.requireDoc()
    const { page, annot } = this.findAnnot(pageIndex, id)
    d.beginOperation('update-annot')
    try {
      if (patch.rect && annot.hasRect()) annot.setRect(patch.rect)
      if (patch.quads && annot.hasQuadPoints()) annot.setQuadPoints(patch.quads as unknown as mupdf.Quad[])
      if (patch.line && annot.hasLine()) annot.setLine(patch.line[0], patch.line[1])
      if (patch.ink && annot.hasInkList()) annot.setInkList(patch.ink as unknown as mupdf.Point[][])
      if (patch.style) applyStyle(annot, annot.getType() as AnnotType, patch.style)
      if (patch.text) {
        annot.setDefaultAppearance('Helv', patch.text.size, patch.text.color ?? [0, 0, 0])
        annot.setContents(patch.text.content)
        annot.setQuadding(patch.text.align)
      }
      if (patch.contents !== undefined) annot.setContents(patch.contents)
      annot.update()
      page.update()
      this.markDirty()
      return this.annotToData(pageIndex, annot)
    } finally {
      d.endOperation()
    }
  }

  deleteAnnot(pageIndex: number, id: string): void {
    const d = this.requireDoc()
    const { page, annot } = this.findAnnot(pageIndex, id)
    d.beginOperation('delete-annot')
    try {
      page.deleteAnnotation(annot)
      this.markDirty()
    } finally {
      d.endOperation()
    }
  }

  // ---------- History ----------

  historyState(): HistoryState {
    const d = this.requireDoc()
    return { canUndo: d.canUndo(), canRedo: d.canRedo() }
  }

  undo(): HistoryState {
    const d = this.requireDoc()
    if (d.canUndo()) d.undo()
    this.markDirty()
    return this.historyState()
  }

  redo(): HistoryState {
    const d = this.requireDoc()
    if (d.canRedo()) d.redo()
    this.markDirty()
    return this.historyState()
  }

  // ---------- Page management ----------

  rotatePage(pageIndex: number, deltaDeg: 90 | -90 | 180): void {
    const d = this.requireDoc()
    const page = d.loadPage(pageIndex)
    d.beginOperation('rotate-page')
    try {
      const cur = getRotation(page)
      const next = ((cur + deltaDeg) % 360 + 360) % 360
      page.getObject().put('Rotate', next)
      this.markDirty()
    } finally {
      d.endOperation()
    }
  }

  deletePage(pageIndex: number): void {
    const d = this.requireDoc()
    d.beginOperation('delete-page')
    try {
      d.deletePage(pageIndex)
      this.markDirty()
    } finally {
      d.endOperation()
    }
  }

  reorderPages(newOrder: number[]): void {
    const d = this.requireDoc()
    d.beginOperation('reorder-pages')
    try {
      d.rearrangePages(newOrder)
      this.markDirty()
    } finally {
      d.endOperation()
    }
  }

  duplicatePage(pageIndex: number): void {
    const d = this.requireDoc()
    d.beginOperation('duplicate-page')
    try {
      const order = Array.from({ length: d.countPages() }, (_, i) => i)
      order.splice(pageIndex + 1, 0, pageIndex)
      d.rearrangePages(order)
      this.markDirty()
    } finally {
      d.endOperation()
    }
  }

  /** Merge: insert every page of another PDF after `afterIndex` (-1 = at the start). Returns the page count inserted. */
  insertPdf(afterIndex: number, srcPath: string, password?: string): number | 'needsPassword' | 'wrongPassword' {
    const d = this.requireDoc()
    const src = mupdf.Document.openDocument(fs.readFileSync(srcPath), 'application/pdf').asPDF()
    if (!src) throw new Error('PDF 문서가 아닙니다.')
    if (src.needsPassword()) {
      if (password === undefined) return 'needsPassword'
      if (!src.authenticatePassword(password)) return 'wrongPassword'
    }
    const n = src.countPages()
    d.beginOperation('insert-pdf')
    try {
      for (let i = 0; i < n; i++) d.graftPage(afterIndex + 1 + i, src, i)
      this.markDirty()
    } finally {
      d.endOperation()
    }
    return n
  }

  /** Split: write the given pages (0-based, in order) to a new unencrypted PDF. */
  extractPages(indices: number[], targetPath: string): void {
    const d = this.requireDoc()
    const out = new mupdf.PDFDocument()
    for (const i of indices) out.graftPage(-1, d, i)
    const tmp = targetPath + '.tmp'
    fs.writeFileSync(tmp, out.saveToBuffer('garbage,compress').asUint8Array())
    fs.renameSync(tmp, targetPath)
  }

  // ---------- Save ----------

  private buildSaveOptions(encryption: SaveOptions['encryption']): string {
    const parts = ['garbage', 'compress']
    if (encryption === 'keep') {
      if (this.password) {
        parts.push('encrypt=aes-256', `user-password=${this.password}`, `owner-password=${this.password}`)
      }
    } else if (encryption !== 'none' && typeof encryption === 'object') {
      parts.push('encrypt=aes-256', `user-password=${encryption.userPassword}`)
      parts.push(`owner-password=${encryption.ownerPassword ?? encryption.userPassword}`)
    }
    return parts.join(',')
  }

  async save(targetPath: string, encryption: SaveOptions['encryption']): Promise<void> {
    const d = this.requireDoc()
    const buf = d.saveToBuffer(this.buildSaveOptions(encryption))
    const bytes = buf.asUint8Array()
    const tmp = targetPath + '.tmp'
    fs.writeFileSync(tmp, bytes)
    fs.renameSync(tmp, targetPath)
    this.filePath = targetPath
    this.dirty = false
    if (encryption !== 'keep' && encryption !== 'none') this.password = encryption.userPassword
    if (encryption === 'none') this.password = null
  }
}
