import { createContext, useContext } from 'react'
import type { TabApi } from '../../../shared/types'
import type { DocStoreHook } from '../store/docStore'
import type { AnnotStoreHook } from '../store/annotStore'
import type { ToolStoreHook } from '../store/toolStore'

export interface TabBundle {
  tabId: string
  api: TabApi
  useDocStore: DocStoreHook
  useAnnotStore: AnnotStoreHook
  useToolStore: ToolStoreHook
}

const TabContext = createContext<TabBundle | null>(null)

export const TabProvider = TabContext.Provider

export function useTab(): TabBundle {
  const ctx = useContext(TabContext)
  if (!ctx) throw new Error('useTab() called outside of a TabProvider')
  return ctx
}
