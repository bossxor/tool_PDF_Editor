// Shared types between main (engine) and renderer (UI).
// Kept dependency-free so both sides can import it safely.

export type RGB = [number, number, number] | null

export interface PageInfo {
  width: number
  height: number
  rotation: number
}

export interface DocInfo {
  pageCount: number
  pages: PageInfo[]
  encrypted: boolean
  permissions: {
    print: boolean
    copy: boolean
    annotate: boolean
    edit: boolean
  }
  title?: string
}

export interface OutlineItem {
  title: string
  page: number | null
  children: OutlineItem[]
}

export interface OpenResult {
  ok: boolean
  needsPassword: boolean
  error?: string
}

export interface TextLine {
  bbox: [number, number, number, number]
  text: string
  fontSize: number
}

export interface SearchHit {
  page: number
  quads: [number, number, number, number, number, number, number, number][]
}

export type AnnotType =
  | 'Highlight'
  | 'Underline'
  | 'StrikeOut'
  | 'Square'
  | 'Circle'
  | 'Line'
  | 'Ink'
  | 'FreeText'
  | 'Text'

export interface AnnotStyle {
  stroke: RGB
  fill: RGB
  width: number
  opacity: number
  dash?: number[]
  lineEnd?: 'None' | 'OpenArrow' | 'ClosedArrow'
}

export interface AnnotTextStyle {
  content: string
  font: 'Helv' | 'TiRo' | 'Cour'
  size: number
  color: RGB
  align: 0 | 1 | 2
}

export interface AnnotData {
  id: string
  page: number
  type: AnnotType
  rect: [number, number, number, number]
  quads?: [number, number, number, number, number, number, number, number][]
  line?: [[number, number], [number, number]]
  ink?: [number, number][][]
  style: AnnotStyle
  text?: AnnotTextStyle
  contents?: string
}

export interface NewAnnotInput {
  type: AnnotType
  rect: [number, number, number, number]
  quads?: [number, number, number, number, number, number, number, number][]
  line?: [[number, number], [number, number]]
  ink?: [number, number][][]
  style: AnnotStyle
  text?: AnnotTextStyle
  contents?: string
}

export interface SaveOptions {
  targetPath: string
  encryption: 'keep' | 'none' | { userPassword: string; ownerPassword?: string }
}

export interface HistoryState {
  canUndo: boolean
  canRedo: boolean
}

// Per-tab operations: every call implicitly targets the EngineSession bound
// to the tab this object was created for (see preload's `forTab(tabId)`).
export interface TabApi {
  openPath: (path: string) => Promise<OpenResult>
  authenticate: (password: string) => Promise<boolean>
  getInfo: () => Promise<DocInfo>
  getOutline: () => Promise<OutlineItem[]>

  renderPage: (page: number, scale: number) => Promise<{ width: number; height: number; png: ArrayBuffer }>
  renderThumbnail: (page: number, width: number) => Promise<{ width: number; height: number; png: ArrayBuffer }>

  getTextLines: (page: number) => Promise<TextLine[]>
  search: (query: string) => Promise<SearchHit[]>
  highlightQuads: (
    page: number,
    p: [number, number],
    q: [number, number]
  ) => Promise<[number, number, number, number, number, number, number, number][]>

  listAnnots: (page: number) => Promise<AnnotData[]>
  createAnnot: (page: number, data: NewAnnotInput) => Promise<AnnotData>
  updateAnnot: (page: number, id: string, patch: Partial<NewAnnotInput>) => Promise<AnnotData>
  deleteAnnot: (page: number, id: string) => Promise<void>

  undo: () => Promise<HistoryState>
  redo: () => Promise<HistoryState>
  historyState: () => Promise<HistoryState>

  rotatePage: (page: number, delta: 90 | -90 | 180) => Promise<void>
  deletePage: (page: number) => Promise<void>
  reorderPages: (order: number[]) => Promise<void>
  duplicatePage: (page: number) => Promise<void>
  insertPdf: (after: number) => Promise<{ ok: boolean; count?: number; error?: string }>
  extractPages: (range: string) => Promise<{ ok: boolean; path?: string; error?: string }>

  save: (opts: { encryption: SaveOptions['encryption'] }) => Promise<{ ok: boolean; path?: string }>
  saveAs: (opts: { encryption: SaveOptions['encryption'] }) => Promise<{ ok: boolean; path?: string }>

  isDirty: () => Promise<boolean>

  print: (opts: { pages: 'all' | 'current' | string; includeAnnots: boolean; currentPage: number }) => Promise<void>
}

// Tab-agnostic operations, exposed once as window.api.
export interface PdfApi {
  openFileDialog: () => Promise<{ canceled: boolean; paths: string[] }>
  createTab: (tabId: string) => Promise<void>
  closeTab: (tabId: string) => Promise<void>
  forTab: (tabId: string) => TabApi
  onOpenRequested: (cb: (path: string) => void) => void
  // Electron only exposes the real filesystem path of a drag-and-dropped
  // File through this API (contextIsolation blocks File.path directly).
  getPathForFile: (file: File) => string
  toggleFullscreen: () => Promise<boolean>
  forceClose: () => Promise<void>
  onCloseRequested: (cb: () => void) => void
  onFullscreenChange: (cb: (isFullscreen: boolean) => void) => void
}

declare global {
  interface Window {
    api: PdfApi
  }
}
