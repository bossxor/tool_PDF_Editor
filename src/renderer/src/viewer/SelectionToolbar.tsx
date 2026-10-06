import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useTab } from '../tabs/TabContext'
import { MARK_TYPES } from './AnnotLayer'
import { IconHighlighter, IconUnderline, IconStrikethrough } from '../ui/icons'
import type { AnnotType } from '../../../shared/types'

type Quad8 = [number, number, number, number, number, number, number, number]

interface Pending {
  pageIndex: number
  quads: Quad8[]
  x: number
  y: number
}

const MARKS: { type: AnnotType; icon: React.FC<{ size?: number }>; title: string }[] = [
  { type: 'Highlight', icon: IconHighlighter, title: '형광펜' },
  { type: 'Underline', icon: IconUnderline, title: '밑줄' },
  { type: 'StrikeOut', icon: IconStrikethrough, title: '취소선' }
]

// Two ways to mark text, both ending up here:
//  1. Tool = 'select': drag-select text, a small toolbar pops up over the
//     selection to choose 형광펜/밑줄/취소선 (Adobe-style).
//  2. Tool = Highlight/Underline/StrikeOut (armed from the main toolbar):
//     every drag is marked immediately with that tool's color the moment
//     it's released, like dragging a real highlighter pen — the tool stays
//     armed so the next drag keeps going without re-clicking anything.
//
// The marked area comes straight from the browser's own selection geometry
// (Range.getClientRects(), one rect per visual line the selection touches),
// converted to PDF points — not from guessing "everything between these two
// corner points" server-side, which used to snap to the whole line.
export default function SelectionToolbar(): React.ReactElement | null {
  const { useDocStore, useToolStore, useAnnotStore } = useTab()
  const info = useDocStore((s) => s.info)
  const editMode = useDocStore((s) => s.editMode)
  const zoom = useDocStore((s) => s.zoom)
  const fitMode = useDocStore((s) => s.fitMode)
  const tool = useToolStore((s) => s.tool)
  const styles = useToolStore((s) => s.styles)
  const create = useAnnotStore((s) => s.create)
  const [pending, setPending] = useState<Pending | null>(null)
  const boxRef = useRef<HTMLDivElement>(null)

  const copyAllowed = info?.permissions.copy ?? false
  const annotateAllowed = info?.permissions.annotate ?? false
  const armedMarkType = MARK_TYPES.has(tool) ? (tool as AnnotType) : null

  const markQuads = useCallback(
    async (pageIndex: number, quads: Quad8[], type: AnnotType): Promise<void> => {
      if (quads.length === 0) return
      const xs = quads.flatMap((q) => [q[0], q[2], q[4], q[6]])
      const ys = quads.flatMap((q) => [q[1], q[3], q[5], q[7]])
      const rect: [number, number, number, number] = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]
      const style = styles[type] ?? { stroke: [1, 0.92, 0.3], fill: null, width: 0, opacity: 0.4 }
      await create(pageIndex, { type, rect, quads, style })
    },
    [styles, create]
  )

  // Reads the live browser selection as PDF-space quads at the CURRENT
  // zoom. Nothing is cached across zoom changes: the selection itself lives
  // in the DOM and survives re-scaling, so we just re-read it.
  const readSelection = useCallback((): (Pending & { bounding: DOMRect }) | null => {
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed || sel.rangeCount === 0 || !info) return null
    const range = sel.getRangeAt(0)
    const anchorEl = (range.commonAncestorContainer.nodeType === 3
      ? range.commonAncestorContainer.parentElement
      : (range.commonAncestorContainer as Element)) as Element | null
    const pageEl = anchorEl?.closest('.page') as HTMLElement | null
    if (!pageEl) return null
    const pageIndex = Number(pageEl.dataset.page)
    const pageInfo = info.pages[pageIndex]
    if (!pageInfo) return null
    const rects = [...range.getClientRects()].filter((r) => r.width > 0.5 && r.height > 0.5)
    if (rects.length === 0) return null
    const pageRect = pageEl.getBoundingClientRect()
    const scale = pageRect.width / pageInfo.width
    const toPdf = (x: number, y: number): [number, number] => [(x - pageRect.left) / scale, (y - pageRect.top) / scale]
    const quads: Quad8[] = rects.map((r) => {
      const [x0, y0] = toPdf(r.left, r.top)
      const [x1, y1] = toPdf(r.right, r.bottom)
      return [x0, y0, x1, y0, x0, y1, x1, y1]
    })
    const bounding = range.getBoundingClientRect()
    return { pageIndex, quads, x: bounding.left + bounding.width / 2, y: bounding.top, bounding }
  }, [info])

  const handleSelectionEnd = useCallback((): void => {
    const r = readSelection()
    if (!r) {
      setPending(null)
      return
    }
    if (armedMarkType) {
      // Pen mode: mark immediately, clear the selection, stay armed.
      window.getSelection()?.removeAllRanges()
      void markQuads(r.pageIndex, r.quads, armedMarkType)
      return
    }
    setPending({ pageIndex: r.pageIndex, quads: r.quads, x: r.x, y: r.y })
  }, [readSelection, armedMarkType, markQuads])

  // Keep the floating toolbar on the selection after the layout moves
  // (zoom, scroll) instead of dropping the selection.
  const followSelection = useCallback((): void => {
    const r = readSelection()
    setPending(r ? { pageIndex: r.pageIndex, quads: r.quads, x: r.x, y: r.y } : null)
  }, [readSelection])

  useEffect(() => {
    if (!copyAllowed || !annotateAllowed || !editMode) return
    const onUp = (e: PointerEvent): void => {
      if (boxRef.current?.contains(e.target as Node)) return
      // Give the browser a tick to finalize the selection after the click/drag.
      setTimeout(handleSelectionEnd, 0)
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
  }, [copyAllowed, annotateAllowed, editMode, handleSelectionEnd])

  useEffect(() => {
    const onScroll = (): void => followSelection()
    const viewer = document.querySelector('.viewer')
    viewer?.addEventListener('scroll', onScroll)
    return () => viewer?.removeEventListener('scroll', onScroll)
  }, [followSelection])

  // Switching tools mid-flight (e.g. pressing Escape) should drop any
  // leftover floating toolbar from the previous mode.
  useEffect(() => {
    setPending(null)
  }, [tool])

  // Zooming rescales the text layer in place, so the DOM selection survives;
  // re-read it after layout settles and the toolbar follows it.
  useEffect(() => {
    const t = setTimeout(followSelection, 60)
    return () => clearTimeout(t)
  }, [zoom, fitMode, followSelection])

  const applyMark = async (type: AnnotType): Promise<void> => {
    // Re-read at apply time so the quads always match the current zoom.
    const r = readSelection()
    setPending(null)
    window.getSelection()?.removeAllRanges()
    if (r) await markQuads(r.pageIndex, r.quads, type)
  }

  if (!pending || !copyAllowed || !annotateAllowed || !editMode) return null

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
