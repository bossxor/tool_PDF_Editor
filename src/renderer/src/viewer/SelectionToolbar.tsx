import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useTab } from '../tabs/TabContext'
import { IconHighlighter, IconUnderline, IconStrikethrough } from '../ui/icons'
import type { AnnotType } from '../../../shared/types'

interface Pending {
  pageIndex: number
  p1: [number, number]
  p2: [number, number]
  x: number
  y: number
}

const MARKS: { type: AnnotType; icon: React.FC<{ size?: number }>; title: string }[] = [
  { type: 'Highlight', icon: IconHighlighter, title: '형광펜' },
  { type: 'Underline', icon: IconUnderline, title: '밑줄' },
  { type: 'StrikeOut', icon: IconStrikethrough, title: '취소선' }
]

// Adobe-style flow: select text with the browser's native selection (the
// TextLayer already supports this), and a small toolbar pops up near the
// selection offering to mark it — no separate "highlight tool" + drag-a-box
// step required.
export default function SelectionToolbar(): React.ReactElement | null {
  const { api, useDocStore, useToolStore, useAnnotStore } = useTab()
  const info = useDocStore((s) => s.info)
  const styles = useToolStore((s) => s.styles)
  const create = useAnnotStore((s) => s.create)
  const [pending, setPending] = useState<Pending | null>(null)
  const boxRef = useRef<HTMLDivElement>(null)

  const copyAllowed = info?.permissions.copy ?? false
  const annotateAllowed = info?.permissions.annotate ?? false

  const computeFromSelection = useCallback((): void => {
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
      setPending(null)
      return
    }
    const range = sel.getRangeAt(0)
    const anchorEl = (range.commonAncestorContainer.nodeType === 3
      ? range.commonAncestorContainer.parentElement
      : (range.commonAncestorContainer as Element)) as Element | null
    const pageEl = anchorEl?.closest('.page') as HTMLElement | null
    if (!pageEl || !info) {
      setPending(null)
      return
    }
    const pageIndex = Number(pageEl.dataset.page)
    const pageInfo = info.pages[pageIndex]
    if (!pageInfo) {
      setPending(null)
      return
    }
    const rects = range.getClientRects()
    if (rects.length === 0) {
      setPending(null)
      return
    }
    const pageRect = pageEl.getBoundingClientRect()
    const scale = pageRect.width / pageInfo.width
    const first = rects[0]
    const last = rects[rects.length - 1]
    const p1: [number, number] = [(first.left - pageRect.left) / scale, (first.top - pageRect.top) / scale]
    const p2: [number, number] = [(last.right - pageRect.left) / scale, (last.bottom - pageRect.top) / scale]
    const bounding = range.getBoundingClientRect()
    setPending({
      pageIndex,
      p1,
      p2,
      x: bounding.left + bounding.width / 2,
      y: bounding.top
    })
  }, [info])

  useEffect(() => {
    if (!copyAllowed || !annotateAllowed) return
    const onUp = (e: PointerEvent): void => {
      // Ignore the mouseup that follows clicking a toolbar button itself.
      if (boxRef.current?.contains(e.target as Node)) return
      // Give the browser a tick to finalize the selection after the click/drag.
      setTimeout(computeFromSelection, 0)
    }
    const onDown = (e: PointerEvent): void => {
      if (boxRef.current?.contains(e.target as Node)) return
      setPending(null)
    }
    document.addEventListener('pointerup', onUp)
    document.addEventListener('pointerdown', onDown)
    return () => {
      document.removeEventListener('pointerup', onUp)
      document.removeEventListener('pointerdown', onDown)
    }
  }, [copyAllowed, annotateAllowed, computeFromSelection])

  useEffect(() => {
    // Selection scrolls out from under a static-positioned toolbar otherwise.
    const onScroll = (): void => setPending(null)
    const viewer = document.querySelector('.viewer')
    viewer?.addEventListener('scroll', onScroll)
    return () => viewer?.removeEventListener('scroll', onScroll)
  }, [])

  const applyMark = async (type: AnnotType): Promise<void> => {
    if (!pending) return
    const { pageIndex, p1, p2 } = pending
    setPending(null)
    const quads = await api.highlightQuads(pageIndex, p1, p2)
    window.getSelection()?.removeAllRanges()
    if (quads.length === 0) return
    const xs = quads.flatMap((q) => [q[0], q[2], q[4], q[6]])
    const ys = quads.flatMap((q) => [q[1], q[3], q[5], q[7]])
    const rect: [number, number, number, number] = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]
    const style = styles[type] ?? { stroke: [1, 0.92, 0.3], fill: null, width: 0, opacity: 0.4 }
    await create(pageIndex, { type, rect, quads, style })
  }

  if (!pending || !copyAllowed || !annotateAllowed) return null

  const left = Math.min(Math.max(pending.x, 90), window.innerWidth - 90)
  const top = Math.max(pending.y - 46, 8)

  return (
    <div ref={boxRef} className="selection-toolbar" style={{ left, top }}>
      {MARKS.map((m) => (
        <button key={m.type} title={m.title} onClick={() => void applyMark(m.type)}>
          <m.icon size={16} />
        </button>
      ))}
    </div>
  )
}
