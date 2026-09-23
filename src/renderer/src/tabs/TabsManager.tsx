import React, { useCallback, useEffect, useRef, useState } from 'react'
import { TabProvider, type TabBundle } from './TabContext'
import { createDocStore } from '../store/docStore'
import { createAnnotStore } from '../store/annotStore'
import { createToolStore } from '../store/toolStore'
import { openDocumentInBundle } from './openDocument'
import Workspace from './Workspace'
import TabBar from './TabBar'
import { IconFileText, IconOpen } from '../ui/icons'

interface TabEntry {
  id: string
  bundle: TabBundle
}

function genId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `tab-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export default function TabsManager(): React.ReactElement {
  const [tabs, setTabs] = useState<TabEntry[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const tabsRef = useRef(tabs)
  tabsRef.current = tabs

  const openNewTab = useCallback(async (path?: string) => {
    const id = genId()
    await window.api.createTab(id)
    const api = window.api.forTab(id)
    const bundle: TabBundle = {
      tabId: id,
      api,
      useDocStore: createDocStore(),
      useAnnotStore: createAnnotStore(api),
      useToolStore: createToolStore()
    }
    setTabs((t) => [...t, { id, bundle }])
    setActiveId(id)
    if (path) void openDocumentInBundle(bundle, path)
  }, [])

  const openFileDialog = useCallback(async () => {
    const result = await window.api.openFileDialog()
    if (result.canceled) return
    for (const p of result.paths) {
      await openNewTab(p)
    }
  }, [openNewTab])

  const closeTab = useCallback(
    async (id: string) => {
      const entry = tabsRef.current.find((t) => t.id === id)
      if (entry) {
        const dirty = entry.bundle.useAnnotStore.getState().dirty
        if (dirty) {
          const ok = window.confirm('저장하지 않은 변경 사항이 있습니다. 그래도 탭을 닫으시겠습니까?')
          if (!ok) return
        }
      }
      await window.api.closeTab(id)
      setTabs((t) => {
        const idx = t.findIndex((x) => x.id === id)
        const next = t.filter((x) => x.id !== id)
        if (activeId === id) {
          const fallback = next[idx] ?? next[idx - 1] ?? next[0]
          setActiveId(fallback ? fallback.id : null)
        }
        return next
      })
    },
    [activeId]
  )

  useEffect(() => {
    window.api.onOpenRequested((path) => {
      void openNewTab(path)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const onDragOver = (e: DragEvent): void => {
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
    }
    const onDrop = (e: DragEvent): void => {
      e.preventDefault()
      const files = Array.from(e.dataTransfer?.files ?? [])
      const pdfFiles = files.filter((f) => f.name.toLowerCase().endsWith('.pdf'))
      for (const f of pdfFiles) {
        const path = window.api.getPathForFile(f)
        if (path) void openNewTab(path)
      }
    }
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('drop', onDrop)
    }
  }, [openNewTab])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === 'w' && activeId) {
        e.preventDefault()
        void closeTab(activeId)
      }
      if (mod && e.key === 'Tab') {
        e.preventDefault()
        const list = tabsRef.current
        if (list.length < 2) return
        const idx = list.findIndex((t) => t.id === activeId)
        const next = e.shiftKey ? (idx - 1 + list.length) % list.length : (idx + 1) % list.length
        setActiveId(list[next].id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [activeId, closeTab])

  if (tabs.length === 0) {
    return (
      <div className="landing">
        <div className="landing-icon">
          <IconFileText size={56} />
        </div>
        <p>PDF 파일을 열어주세요</p>
        <span className="hint">파일을 끌어다 놓거나 아래 버튼을 눌러 시작하세요</span>
        <button onClick={() => void openFileDialog()}>
          <IconOpen size={15} /> 파일 열기
        </button>
      </div>
    )
  }

  const active = tabs.find((t) => t.id === activeId)

  return (
    <div className="tabs-root">
      <TabBar
        tabs={tabs.map((t) => ({ id: t.id, bundle: t.bundle }))}
        activeId={activeId}
        onSelect={setActiveId}
        onClose={(id) => void closeTab(id)}
        onNewTab={() => void openFileDialog()}
      />
      {active && (
        <TabProvider key={active.id} value={active.bundle}>
          <Workspace onOpenNewTab={() => void openFileDialog()} />
        </TabProvider>
      )}
    </div>
  )
}
