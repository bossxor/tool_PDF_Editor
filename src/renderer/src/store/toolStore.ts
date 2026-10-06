import { create, type UseBoundStore, type StoreApi } from 'zustand'
import type { AnnotStyle, AnnotType } from '../../../shared/types'

export type ToolId = 'select' | 'pan' | AnnotType

const DEFAULT_STYLES: Record<string, AnnotStyle> = {
  Highlight: { stroke: [1, 0.92, 0.3], fill: null, width: 0, opacity: 0.4 },
  Underline: { stroke: [0.1, 0.4, 0.9], fill: null, width: 1, opacity: 1 },
  StrikeOut: { stroke: [0.9, 0.1, 0.1], fill: null, width: 1, opacity: 1 },
  Square: { stroke: [0.9, 0.1, 0.1], fill: null, width: 2, opacity: 1 },
  Circle: { stroke: [0.9, 0.1, 0.1], fill: null, width: 2, opacity: 1 },
  Line: { stroke: [0.1, 0.1, 0.1], fill: null, width: 2, opacity: 1, lineEnd: 'None' },
  Ink: { stroke: [0.9, 0.1, 0.1], fill: null, width: 2, opacity: 1 },
  FreeText: { stroke: [0, 0, 0], fill: [1, 1, 0.6], width: 1, opacity: 1 },
  Text: { stroke: [1, 0.85, 0.3], fill: null, width: 0, opacity: 1 }
}

function loadPersisted(): Record<string, AnnotStyle> {
  try {
    const raw = localStorage.getItem('pdf-editor:tool-styles')
    if (raw) return { ...DEFAULT_STYLES, ...JSON.parse(raw) }
  } catch {
    /* ignore */
  }
  return DEFAULT_STYLES
}

interface ToolState {
  tool: ToolId
  styles: Record<string, AnnotStyle>
  selectedAnnotId: string | null
  setTool: (t: ToolId) => void
  setStyle: (type: string, style: Partial<AnnotStyle>) => void
  setSelected: (id: string | null) => void
}

export type ToolStoreHook = UseBoundStore<StoreApi<ToolState>>

export function createToolStore(): ToolStoreHook {
  return create<ToolState>((set, get) => ({
    tool: 'select',
    styles: loadPersisted(),
    selectedAnnotId: null,
    setTool: (t) => set({ tool: t, selectedAnnotId: null }),
    setStyle: (type, patch) => {
      const next = { ...get().styles, [type]: { ...get().styles[type], ...patch } }
      set({ styles: next })
      try {
        localStorage.setItem('pdf-editor:tool-styles', JSON.stringify(next))
      } catch {
        /* ignore */
      }
    },
    setSelected: (id) => set({ selectedAnnotId: id })
  }))
}
