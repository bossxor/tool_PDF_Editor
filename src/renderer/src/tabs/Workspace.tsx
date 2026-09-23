import React, { useCallback, useEffect, useState } from 'react'
import { useTab } from './TabContext'
import { loadInfoInBundle } from './openDocument'
import Toolbar from '../panels/Toolbar'
import Sidebar from '../panels/Sidebar'
import Viewer from '../viewer/Viewer'
import PasswordDialog from '../dialogs/PasswordDialog'
import SearchBar from '../panels/SearchBar'
import PropertyPanel from '../panels/PropertyPanel'
import SaveOptionsDialog from '../dialogs/SaveOptionsDialog'
import PrintDialog from '../dialogs/PrintDialog'

export default function Workspace({ onOpenNewTab }: { onOpenNewTab: () => void }): React.ReactElement {
  const tab = useTab()
  const { api, useDocStore, useAnnotStore, useToolStore } = tab

  const needsPassword = useDocStore((s) => s.needsPassword)
  const passwordError = useDocStore((s) => s.passwordError)
  const setPasswordError = useDocStore((s) => s.setPasswordError)
  const setError = useDocStore((s) => s.setError)
  const errorMessage = useDocStore((s) => s.errorMessage)
  const info = useDocStore((s) => s.info)
  const filePath = useDocStore((s) => s.filePath)
  const reset = useDocStore((s) => s.reset)
  const currentPage = useDocStore((s) => s.currentPage)
  const [searchOpen, setSearchOpen] = useState(false)
  const [saveAsOpen, setSaveAsOpen] = useState(false)
  const [printOpen, setPrintOpen] = useState(false)

  const invalidateAll = useAnnotStore((s) => s.invalidateAll)
  const undo = useAnnotStore((s) => s.undo)
  const redo = useAnnotStore((s) => s.redo)
  const dirty = useAnnotStore((s) => s.dirty)

  const loadInfo = useCallback(() => loadInfoInBundle(tab), [tab])

  const handleSave = useCallback(async () => {
    const result = await api.save({ encryption: 'keep' })
    if (!result.ok) {
      setError('저장에 실패했습니다.')
      return
    }
    useAnnotStore.setState({ dirty: false })
  }, [api, setError, useAnnotStore])

  const handleSaveAs = useCallback(
    async (encryption: 'keep' | 'none' | { userPassword: string; ownerPassword?: string }) => {
      setSaveAsOpen(false)
      const result = await api.saveAs({ encryption })
      if (!result.ok) return
      useAnnotStore.setState({ dirty: false })
      useDocStore.setState({ filePath: result.path ?? null })
    },
    [api, useAnnotStore, useDocStore]
  )

  const handlePasswordSubmit = useCallback(
    async (pw: string) => {
      const ok = await api.authenticate(pw)
      if (!ok) {
        setPasswordError('비밀번호가 틀렸습니다.')
        return
      }
      await loadInfo()
    },
    [api, loadInfo, setPasswordError]
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const mod = e.ctrlKey || e.metaKey
      if (mod && !e.shiftKey && e.key.toLowerCase() === 'o') {
        e.preventDefault()
        onOpenNewTab()
      }
      if (mod && e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault()
        if (info) setSaveAsOpen(true)
      } else if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault()
        if (info) void handleSave()
      }
      if (mod && e.key.toLowerCase() === 'f' && info) {
        e.preventDefault()
        setSearchOpen((v) => !v)
      }
      if (mod && e.key.toLowerCase() === 'p' && info) {
        e.preventDefault()
        setPrintOpen(true)
      }
      if (mod && e.key.toLowerCase() === 'z' && info) {
        e.preventDefault()
        void undo()
      }
      if (mod && e.key.toLowerCase() === 'y' && info) {
        e.preventDefault()
        void redo()
      }

      // Single-key tool shortcuts — only when not typing in a field.
      if (!mod && !e.altKey && info) {
        const tag = (e.target as HTMLElement | null)?.tagName
        if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
          const map: Record<string, string> = {
            v: 'select',
            r: 'Square',
            o: 'Circle',
            l: 'Line',
            p: 'Ink',
            x: 'FreeText',
            n: 'Text'
          }
          const t = map[e.key.toLowerCase()]
          if (t) {
            e.preventDefault()
            useToolStore.getState().setTool(t as never)
          }
          if (e.key === 'Escape') {
            useToolStore.getState().setTool('select')
          }
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleSave, info, undo, redo, onOpenNewTab, useToolStore])

  return (
    <div className="app">
      <Toolbar
        onOpen={onOpenNewTab}
        onSave={() => void handleSave()}
        onSaveAs={() => setSaveAsOpen(true)}
        onPrint={() => setPrintOpen(true)}
      />
      <div className="body">
        <Sidebar
          onPagesChanged={async () => {
            await loadInfo()
            invalidateAll()
          }}
        />
        <div className="viewer-column">
          {searchOpen && <SearchBar onClose={() => setSearchOpen(false)} />}
          <Viewer />
        </div>
        <PropertyPanel />
      </div>
      {errorMessage && (
        <div className="toast error">
          {errorMessage}
          <button onClick={() => setError(null)}>닫기</button>
        </div>
      )}
      {needsPassword && !info && (
        <PasswordDialog error={passwordError} onSubmit={handlePasswordSubmit} onCancel={() => reset()} />
      )}
      {saveAsOpen && info && (
        <SaveOptionsDialog
          wasEncrypted={info.encrypted}
          onCancel={() => setSaveAsOpen(false)}
          onConfirm={(enc) => void handleSaveAs(enc)}
        />
      )}
      {printOpen && info && (
        <PrintDialog
          currentPage={currentPage}
          pageCount={info.pageCount}
          onClose={() => setPrintOpen(false)}
          onPrint={(opts) => {
            void api.print(opts).finally(() => setPrintOpen(false))
          }}
        />
      )}
      <div className="statusbar">{filePath ? `${filePath}${dirty ? ' *' : ''}` : '문서가 열려 있지 않습니다'}</div>
    </div>
  )
}
