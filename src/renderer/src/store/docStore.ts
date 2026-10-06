import { create, type UseBoundStore, type StoreApi } from 'zustand'
import type { DocInfo, OutlineItem, SearchHit } from '../../../shared/types'

interface DocState {
  filePath: string | null
  info: DocInfo | null
  outline: OutlineItem[]
  needsPassword: boolean
  passwordError: string | null
  loading: boolean
  errorMessage: string | null

  currentPage: number
  zoom: number // 1 = 100%
  fitMode: 'width' | 'page' | 'custom'
  twoPage: boolean // facing-pages layout
  editMode: boolean // false = read-only viewer (default); true = annotation tools shown

  search: { hits: SearchHit[]; index: number } | null // one hit per match, highlighted on the pages

  setSearch: (s: { hits: SearchHit[]; index: number } | null) => void
  setLoading: (v: boolean) => void
  setError: (msg: string | null) => void
  setOpened: (filePath: string, needsPassword: boolean) => void
  setInfo: (info: DocInfo, outline: OutlineItem[]) => void
  setPasswordError: (msg: string | null) => void
  setCurrentPage: (p: number) => void
  setZoom: (z: number) => void
  setFitMode: (m: 'width' | 'page' | 'custom') => void
  setEditMode: (v: boolean) => void
  setTwoPage: (v: boolean) => void
  reset: () => void
}

export type DocStoreHook = UseBoundStore<StoreApi<DocState>>

export function createDocStore(): DocStoreHook {
  return create<DocState>((set) => ({
    filePath: null,
    info: null,
    outline: [],
    needsPassword: false,
    passwordError: null,
    loading: false,
    errorMessage: null,

    currentPage: 0,
    zoom: 1,
    fitMode: 'width',
    editMode: false,
    twoPage: false,
    search: null,

    setSearch: (search) => set({ search }),
    setLoading: (v) => set({ loading: v }),
    setError: (msg) => set({ errorMessage: msg }),
    setOpened: (filePath, needsPassword) =>
      set({ filePath, needsPassword, passwordError: null, info: null, currentPage: 0 }),
    setInfo: (info, outline) => set({ info, outline, needsPassword: false, search: null }),
    setPasswordError: (msg) => set({ passwordError: msg }),
    setCurrentPage: (p) => set({ currentPage: p }),
    setZoom: (z) => set({ zoom: z, fitMode: 'custom' }),
    setFitMode: (m) => set({ fitMode: m }),
    setEditMode: (v) => set({ editMode: v }),
    setTwoPage: (v) => set({ twoPage: v }),
    reset: () =>
      set({
        filePath: null,
        info: null,
        outline: [],
        needsPassword: false,
        passwordError: null,
        currentPage: 0,
        errorMessage: null
      })
  }))
}
