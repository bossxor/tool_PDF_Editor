import React, { useEffect, useRef, useState } from 'react'
import { useTab } from '../tabs/TabContext'
import type { OutlineItem, TabApi } from '../../../shared/types'
import ConfirmDialog from '../dialogs/ConfirmDialog'
import PasswordDialog from '../dialogs/PasswordDialog'
import { IconRotateLeft, IconRotateRight, IconCopy, IconTrash, IconPlus, IconSaveAs } from '../ui/icons'

function Thumb({
  api,
  index,
  active,
  version,
  draggable,
  onClick,
  onContextMenu,
  onDragStart,
  onDragOver,
  onDrop
}: {
  api: TabApi
  index: number
  active: boolean
  version: number
  draggable: boolean
  onClick: () => void
  onContextMenu: (e: React.MouseEvent) => void
  onDragStart: (e: React.DragEvent) => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
}): React.ReactElement {
  const [url, setUrl] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setUrl(null)
  }, [version])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          api.renderThumbnail(index, 120).then((r) => {
            const blob = new Blob([r.png], { type: 'image/png' })
            setUrl((prev) => {
              if (prev) URL.revokeObjectURL(prev)
              return URL.createObjectURL(blob)
            })
          })
        }
      },
      { root: el.closest('.sidebar-scroll'), rootMargin: '200px' }
    )
    io.observe(el)
    return () => io.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, version])

  return (
    <div
      ref={ref}
      className={`thumb ${active ? 'active' : ''}`}
      onClick={onClick}
      onContextMenu={onContextMenu}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {url ? <img src={url} alt={`${index + 1}`} /> : <div className="thumb-placeholder" />}
      <span>{index + 1}</span>
    </div>
  )
}

function OutlineList({ items, onGo }: { items: OutlineItem[]; onGo: (p: number) => void }): React.ReactElement {
  return (
    <ul className="outline-list">
      {items.map((it, i) => (
        <li key={i}>
          <button className="outline-item" onClick={() => it.page !== null && onGo(it.page)}>
            {it.title}
          </button>
          {it.children.length > 0 && <OutlineList items={it.children} onGo={onGo} />}
        </li>
      ))}
    </ul>
  )
}

export default function Sidebar({ onPagesChanged }: { onPagesChanged: () => Promise<void> }): React.ReactElement {
  const { api, useDocStore } = useTab()
  const info = useDocStore((s) => s.info)
  const outline = useDocStore((s) => s.outline)
  const currentPage = useDocStore((s) => s.currentPage)
  const setCurrentPage = useDocStore((s) => s.setCurrentPage)
  const setError = useDocStore((s) => s.setError)
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null)
  const [extractRange, setExtractRange] = useState<string | null>(null)
  const [tab, setTab] = useState<'thumbs' | 'outline'>('thumbs')
  const [version, setVersion] = useState(0)
  const [menu, setMenu] = useState<{ index: number; x: number; y: number } | null>(null)
  const dragFrom = useRef<number | null>(null)

  const goTo = (p: number): void => {
    setCurrentPage(p)
    const el = document.querySelector(`.page[data-page="${p}"]`)
    el?.scrollIntoView({ block: 'start' })
  }

  const afterEdit = async (): Promise<void> => {
    await onPagesChanged()
    setVersion((v) => v + 1)
  }

  const rotate = async (index: number, delta: 90 | -90): Promise<void> => {
    await api.rotatePage(index, delta)
    await afterEdit()
  }

  const duplicate = async (index: number): Promise<void> => {
    await api.duplicatePage(index)
    await afterEdit()
  }

  const [mergePw, setMergePw] = useState<{ after: number; path: string; error: string | null } | null>(null)

  const insertPdf = async (after: number, path?: string, password?: string): Promise<void> => {
    setMenu(null)
    const r = await api.insertPdf(after, path, password)
    if (r.needsPassword && r.path) {
      setMergePw({ after, path: r.path, error: r.error ?? null })
      return
    }
    setMergePw(null)
    if (r.error) setError(r.error)
    if (r.ok) await afterEdit()
  }

  const extract = async (): Promise<void> => {
    if (extractRange === null) return
    const r = await api.extractPages(extractRange)
    if (r.error) setError(r.error)
    else setExtractRange(null)
  }

  const remove = async (index: number): Promise<void> => {
    if (info && info.pageCount <= 1) return
    setMenu(null)
    setDeleteIndex(index)
  }

  const confirmDelete = async (): Promise<void> => {
    if (deleteIndex === null) return
    const index = deleteIndex
    setDeleteIndex(null)
    await api.deletePage(index)
    await afterEdit()
  }

  const reorder = async (from: number, to: number): Promise<void> => {
    if (!info || from === to) return
    const order = info.pages.map((_, i) => i)
    const [moved] = order.splice(from, 1)
    order.splice(to, 0, moved)
    await api.reorderPages(order)
    await afterEdit()
  }

  if (!info) return <aside className="sidebar" />

  return (
    <aside className="sidebar" onClick={() => setMenu(null)}>
      <div className="sidebar-tabs">
        <button className={tab === 'thumbs' ? 'active' : ''} onClick={() => setTab('thumbs')}>
          썸네일
        </button>
        <button className={tab === 'outline' ? 'active' : ''} onClick={() => setTab('outline')} disabled={outline.length === 0}>
          목차
        </button>
      </div>
      <div className="sidebar-scroll">
        {tab === 'thumbs' &&
          info.pages.map((_, i) => (
            <Thumb
              key={i}
              api={api}
              index={i}
              active={i === currentPage}
              version={version}
              draggable
              onClick={() => goTo(i)}
              onContextMenu={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setMenu({ index: i, x: e.clientX, y: e.clientY })
              }}
              onDragStart={() => {
                dragFrom.current = i
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                if (dragFrom.current !== null) void reorder(dragFrom.current, i)
                dragFrom.current = null
              }}
            />
          ))}
        {tab === 'outline' && <OutlineList items={outline} onGo={goTo} />}
      </div>
      {menu && (
        <div className="context-menu" style={{ left: menu.x, top: menu.y }} onClick={(e) => e.stopPropagation()}>
          <button onClick={() => void rotate(menu.index, -90).then(() => setMenu(null))}>
            <IconRotateLeft size={15} /> 왼쪽으로 회전
          </button>
          <button onClick={() => void rotate(menu.index, 90).then(() => setMenu(null))}>
            <IconRotateRight size={15} /> 오른쪽으로 회전
          </button>
          <button onClick={() => void duplicate(menu.index).then(() => setMenu(null))}>
            <IconCopy size={15} /> 페이지 복제
          </button>
          <button onClick={() => void insertPdf(menu.index)}>
            <IconPlus size={15} /> 뒤에 PDF 삽입 (병합)
          </button>
          <button
            onClick={() => {
              setExtractRange(String(menu.index + 1))
              setMenu(null)
            }}
          >
            <IconSaveAs size={15} /> 페이지 추출 (분할)
          </button>
          <button className="danger" onClick={() => void remove(menu.index)}>
            <IconTrash size={15} /> 페이지 삭제
          </button>
        </div>
      )}
      {mergePw && (
        <PasswordDialog
          error={mergePw.error}
          onSubmit={(pw) => void insertPdf(mergePw.after, mergePw.path, pw)}
          onCancel={() => setMergePw(null)}
        />
      )}
      {deleteIndex !== null && (
        <ConfirmDialog
          title={`${deleteIndex + 1}페이지를 삭제할까요?`}
          message="저장하면 삭제한 페이지를 복구할 수 없습니다."
          buttons={[
            { key: 'cancel', label: '취소' },
            { key: 'delete', label: '삭제', variant: 'danger' }
          ]}
          onChoose={(k) => (k === 'delete' ? void confirmDelete() : setDeleteIndex(null))}
        />
      )}
      {extractRange !== null && (
        <div className="modal-backdrop" onClick={(e) => e.stopPropagation()}>
          <div className="modal">
            <h3>페이지 추출</h3>
            <p>새 PDF로 저장할 페이지 (전체 {info.pageCount}페이지)</p>
            <input
              autoFocus
              value={extractRange}
              placeholder="예: 1-3,5"
              onChange={(e) => setExtractRange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void extract()
                if (e.key === 'Escape') setExtractRange(null)
              }}
            />
            <div className="modal-actions">
              <button onClick={() => setExtractRange(null)}>취소</button>
              <button className="primary" onClick={() => void extract()}>
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}
