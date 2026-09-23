import React, { useEffect, useRef, useState } from 'react'
import { useTab } from '../tabs/TabContext'
import type { OutlineItem, TabApi } from '../../../shared/types'
import { IconRotateLeft, IconRotateRight, IconCopy, IconTrash } from '../ui/icons'

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

  const remove = async (index: number): Promise<void> => {
    if (info && info.pageCount <= 1) return
    if (!window.confirm(`${index + 1}페이지를 삭제하시겠습니까?`)) return
    await api.deletePage(index)
    await afterEdit()
    setMenu(null)
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
          <button className="danger" onClick={() => void remove(menu.index)}>
            <IconTrash size={15} /> 페이지 삭제
          </button>
        </div>
      )}
    </aside>
  )
}
