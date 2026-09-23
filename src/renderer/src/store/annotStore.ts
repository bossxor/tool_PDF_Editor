import { create, type UseBoundStore, type StoreApi } from 'zustand'
import type { AnnotData, NewAnnotInput, TabApi } from '../../../shared/types'

interface AnnotState {
  byPage: Record<number, AnnotData[]>
  canUndo: boolean
  canRedo: boolean
  dirty: boolean
  loadPage: (page: number) => Promise<void>
  create: (page: number, input: NewAnnotInput) => Promise<AnnotData>
  update: (page: number, id: string, patch: Partial<NewAnnotInput>) => Promise<void>
  remove: (page: number, id: string) => Promise<void>
  undo: () => Promise<void>
  redo: () => Promise<void>
  refreshHistory: () => Promise<void>
  invalidateAll: () => void
  reset: () => void
}

export type AnnotStoreHook = UseBoundStore<StoreApi<AnnotState>>

export function createAnnotStore(api: TabApi): AnnotStoreHook {
  return create<AnnotState>((set, get) => ({
    byPage: {},
    canUndo: false,
    canRedo: false,
    dirty: false,

    loadPage: async (page) => {
      const list = await api.listAnnots(page)
      set((s) => ({ byPage: { ...s.byPage, [page]: list } }))
    },

    create: async (page, input) => {
      const annot = await api.createAnnot(page, input)
      set((s) => ({ byPage: { ...s.byPage, [page]: [...(s.byPage[page] ?? []), annot] }, dirty: true }))
      await get().refreshHistory()
      return annot
    },

    update: async (page, id, patch) => {
      const annot = await api.updateAnnot(page, id, patch)
      set((s) => ({
        byPage: {
          ...s.byPage,
          [page]: (s.byPage[page] ?? []).map((a) => (a.id === id ? annot : a))
        },
        dirty: true
      }))
      await get().refreshHistory()
    },

    remove: async (page, id) => {
      await api.deleteAnnot(page, id)
      set((s) => ({
        byPage: { ...s.byPage, [page]: (s.byPage[page] ?? []).filter((a) => a.id !== id) },
        dirty: true
      }))
      await get().refreshHistory()
    },

    undo: async () => {
      const hs = await api.undo()
      set({ canUndo: hs.canUndo, canRedo: hs.canRedo, byPage: {}, dirty: true })
    },

    redo: async () => {
      const hs = await api.redo()
      set({ canUndo: hs.canUndo, canRedo: hs.canRedo, byPage: {}, dirty: true })
    },

    refreshHistory: async () => {
      const hs = await api.historyState()
      set({ canUndo: hs.canUndo, canRedo: hs.canRedo })
    },

    invalidateAll: () => set({ byPage: {} }),

    reset: () => set({ byPage: {}, canUndo: false, canRedo: false, dirty: false })
  }))
}
