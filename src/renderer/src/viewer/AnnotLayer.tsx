import React, { useEffect, useRef, useState } from 'react'
import { useTab } from '../tabs/TabContext'
import type { ToolId } from '../store/toolStore'
import type { AnnotData, AnnotStyle, NewAnnotInput } from '../../../shared/types'

interface EditingState {
  id: string | null // null = creating a new annotation
  type: 'FreeText' | 'Text'
  rect: [number, number, number, number]
  content: string
  style: AnnotStyle
}

interface Props {
  pageIndex: number
  width: number
  height: number
  scale: number
}

// Highlight/Underline/StrikeOut are marked by dragging over real text (see
// SelectionToolbar), not by drawing a box on this SVG layer — they're
// handled separately from the shape/ink/text-box tools below.
const DRAW_TYPES = new Set(['Square', 'Circle', 'Line', 'Ink', 'FreeText', 'Text'])
export const MARK_TYPES = new Set(['Highlight', 'Underline', 'StrikeOut'])

function rgbToCss(c: [number, number, number] | null, opacity = 1): string {
  if (!c) return 'none'
  const [r, g, b] = c.map((v) => Math.round(v * 255))
  return `rgba(${r},${g},${b},${opacity})`
}

type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'p0' | 'p1'
const RECT_HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
const RESIZABLE = new Set(['Square', 'Circle', 'FreeText', 'Line', 'Ink'])

type Rect = [number, number, number, number]

/** Geometry change for dragging `orig` by (dx, dy) — a move without a handle, a resize with one. */
export function dragPatch(orig: AnnotData, dx: number, dy: number, handle?: Handle): Partial<AnnotData> {
  const [x0, y0, x1, y1] = orig.rect
  if (orig.type === 'Line' && orig.line) {
    const [a, b] = orig.line
    const line: [[number, number], [number, number]] = [
      handle === 'p1' ? a : [a[0] + dx, a[1] + dy],
      handle === 'p0' ? b : [b[0] + dx, b[1] + dy]
    ]
    const rect: Rect = [
      Math.min(line[0][0], line[1][0]),
      Math.min(line[0][1], line[1][1]),
      Math.max(line[0][0], line[1][0]),
      Math.max(line[0][1], line[1][1])
    ]
    return { line, rect }
  }
  if (handle) {
    const nx0 = handle.includes('w') ? x0 + dx : x0
    const nx1 = handle.includes('e') ? x1 + dx : x1
    const ny0 = handle.includes('n') ? y0 + dy : y0
    const ny1 = handle.includes('s') ? y1 + dy : y1
    // Dragging past the opposite edge flips instead of producing a negative box.
    const rect: Rect = [Math.min(nx0, nx1), Math.min(ny0, ny1), Math.max(nx0, nx1), Math.max(ny0, ny1)]
    if (orig.type === 'Ink' && orig.ink) {
      // Strokes have no box of their own: map every point from the old bbox into the new one.
      const sx = x1 > x0 ? (nx1 - nx0) / (x1 - x0) : 1
      const sy = y1 > y0 ? (ny1 - ny0) / (y1 - y0) : 1
      const ink = orig.ink.map((stroke) =>
        stroke.map(([x, y]) => [nx0 + (x - x0) * sx, ny0 + (y - y0) * sy] as [number, number])
      )
      return { ink, rect }
    }
    return { rect }
  }
  if (orig.type === 'Ink' && orig.ink) {
    return { ink: orig.ink.map((stroke) => stroke.map(([x, y]) => [x + dx, y + dy] as [number, number])) }
  }
  if (orig.quads) {
    return { quads: orig.quads.map((q) => q.map((v, i) => (i % 2 === 0 ? v + dx : v + dy)) as typeof q) }
  }
  return { rect: [x0 + dx, y0 + dy, x1 + dx, y1 + dy] }
}

export default function AnnotLayer({ pageIndex, width, height, scale }: Props): React.ReactElement {
  const { api, useDocStore, useToolStore, useAnnotStore } = useTab()
  const editMode = useDocStore((s) => s.editMode)
  const zoom = useDocStore((s) => s.zoom)
  const fitMode = useDocStore((s) => s.fitMode)
  const tool = useToolStore((s) => s.tool)
  const styles = useToolStore((s) => s.styles)
  const selectedId = useToolStore((s) => s.selectedAnnotId)
  const setSelected = useToolStore((s) => s.setSelected)
  const annots = useAnnotStore((s) => s.byPage[pageIndex])
  const loadPage = useAnnotStore((s) => s.loadPage)
  const create = useAnnotStore((s) => s.create)
  const update = useAnnotStore((s) => s.update)
  const remove = useAnnotStore((s) => s.remove)

  const svgRef = useRef<SVGSVGElement>(null)
  const [drag, setDrag] = useState<{ start: [number, number]; cur: [number, number]; ink: [number, number][] } | null>(
    null
  )
  // Drag on the shape body moves it; drag on a handle resizes it. Both
  // preview locally and write once on release.
  const [moving, setMoving] = useState<{
    id: string
    start: [number, number]
    orig: AnnotData
    dx: number
    dy: number
    handle?: Handle
  } | null>(null)
  const [editing, setEditing] = useState<EditingState | null>(null)
  const editCancelledRef = useRef(false)

  useEffect(() => {
    if (annots === undefined) void loadPage(pageIndex)
  }, [pageIndex, annots, loadPage])

  // Zooming mid-draw/mid-drag would place the shape using a mix of old and
  // new scale — safer to just drop the in-progress interaction and let the
  // user redo it at the new zoom level.
  useEffect(() => {
    setDrag(null)
    setMoving(null)
  }, [zoom, fitMode])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (editing || !editMode) return
      if (e.key !== 'Delete' || !selectedId) return
      // Every visible page mounts its own AnnotLayer — only the page that
      // actually owns the selected annotation may act on it.
      if (!(annots ?? []).some((a) => a.id === selectedId)) return
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      void remove(pageIndex, selectedId)
      setSelected(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedId, pageIndex, remove, setSelected, editing, editMode, annots])

  const toPdf = (clientX: number, clientY: number): [number, number] => {
    const rect = svgRef.current!.getBoundingClientRect()
    return [(clientX - rect.left) / scale, (clientY - rect.top) / scale]
  }

  const isDrawTool = DRAW_TYPES.has(tool)

  const onPointerDown = (e: React.PointerEvent): void => {
    if (e.target !== e.currentTarget && tool === 'select') return // clicks handled by shapes
    const p = toPdf(e.clientX, e.clientY)
    if (isDrawTool) {
      ;(e.target as Element).setPointerCapture(e.pointerId)
      setDrag({ start: p, cur: p, ink: [p] })
    } else if (tool === 'select') {
      setSelected(null)
    }
  }

  const onPointerMove = (e: React.PointerEvent): void => {
    if (drag) {
      const p = toPdf(e.clientX, e.clientY)
      setDrag((d) => (d ? { ...d, cur: p, ink: tool === 'Ink' ? [...d.ink, p] : d.ink } : d))
    } else if (moving) {
      // Preview only — the move is committed once on release (see
      // commitMove). Writing on every mousemove used to flood the engine
      // with IPC calls and leave one undo step per pixel of movement.
      const p = toPdf(e.clientX, e.clientY)
      setMoving((m) => (m ? { ...m, dx: p[0] - m.start[0], dy: p[1] - m.start[1] } : m))
    }
  }

  const commitMove = async (): Promise<void> => {
    if (!moving) return
    const { id, orig, dx, dy, handle } = moving
    setMoving(null)
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return // plain click, nothing moved
    await update(pageIndex, id, dragPatch(orig, dx, dy, handle))
  }

  // Like Acrobat: once a shape is placed, drop back to the select tool with
  // the new shape selected, so it can be dragged/resized right away.
  const pick = (a: AnnotData): void => {
    useToolStore.getState().setTool('select')
    setSelected(a.id)
  }

  const commitDraw = async (): Promise<void> => {
    if (!drag) return
    const [sx, sy] = drag.start
    const [cx, cy] = drag.cur
    const rect: [number, number, number, number] = [Math.min(sx, cx), Math.min(sy, cy), Math.max(sx, cx), Math.max(sy, cy)]
    const type = tool as NewAnnotInput['type']
    const style = styles[type] ?? { stroke: [0, 0, 0], fill: null, width: 1, opacity: 1 }

    if (Math.abs(rect[2] - rect[0]) < 2 && Math.abs(rect[3] - rect[1]) < 2 && tool !== 'FreeText' && tool !== 'Text') {
      setDrag(null)
      return
    }

    if (type === 'Highlight' || type === 'Underline' || type === 'StrikeOut') {
      const quads = await api.highlightQuads(pageIndex, drag.start, drag.cur)
      if (quads.length === 0) {
        setDrag(null)
        return
      }
      const xs = quads.flatMap((q) => [q[0], q[2], q[4], q[6]])
      const ys = quads.flatMap((q) => [q[1], q[3], q[5], q[7]])
      const bbox: [number, number, number, number] = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]
      await create(pageIndex, { type, rect: bbox, quads, style })
    } else if (type === 'Line') {
      pick(
        await create(pageIndex, {
          type,
          rect,
          line: [drag.start, drag.cur],
          style
        })
      )
    } else if (type === 'Ink') {
      const xs = drag.ink.map((p) => p[0])
      const ys = drag.ink.map((p) => p[1])
      const bbox: [number, number, number, number] = [
        Math.min(...xs) - style.width,
        Math.min(...ys) - style.width,
        Math.max(...xs) + style.width,
        Math.max(...ys) + style.width
      ]
      await create(pageIndex, { type, rect: bbox, ink: [drag.ink], style })
    } else if (type === 'FreeText') {
      const finalRect: [number, number, number, number] =
        rect[2] - rect[0] < 40 ? [rect[0], rect[1], rect[0] + 180, rect[1] + 60] : rect
      setDrag(null)
      setEditing({ id: null, type: 'FreeText', rect: finalRect, content: '', style })
      return
    } else if (type === 'Text') {
      const finalRect: [number, number, number, number] = [rect[0], rect[1], rect[0] + 220, rect[1] + 130]
      setDrag(null)
      setEditing({ id: null, type: 'Text', rect: finalRect, content: '', style })
      return
    } else {
      pick(await create(pageIndex, { type, rect, style }))
    }
    setDrag(null)
  }

  const commitEdit = async (): Promise<void> => {
    if (!editing) return
    if (editCancelledRef.current) {
      editCancelledRef.current = false
      return
    }
    const state = editing
    setEditing(null)
    const content = state.content.trim()
    if (state.id) {
      // editing an existing annotation
      if (state.type === 'FreeText') {
        const existing = (annots ?? []).find((a) => a.id === state.id)
        await update(pageIndex, state.id, {
          text: { content, font: 'Helv', size: existing?.text?.size ?? 12, color: existing?.text?.color ?? [0, 0, 0], align: 0 }
        })
      } else {
        await update(pageIndex, state.id, { contents: content })
      }
    } else if (content) {
      if (state.type === 'FreeText') {
        pick(
          await create(pageIndex, {
            type: 'FreeText',
            rect: state.rect,
            style: state.style,
            text: { content, font: 'Helv', size: 12, color: [0, 0, 0], align: 0 }
          })
        )
      } else {
        await create(pageIndex, { type: 'Text', rect: [state.rect[0], state.rect[1], state.rect[0] + 24, state.rect[1] + 24], style: state.style, contents: content })
      }
    }
    if (state.id) {
      useToolStore.getState().setTool('select')
      setSelected(state.id)
    }
  }

  const onPointerUp = (): void => {
    if (drag) void commitDraw()
    if (moving) void commitMove()
  }

  const renderShape = (a: AnnotData): React.ReactElement => {
    if (editing && editing.id === a.id) return <g key={a.id} />
    const isSelected = a.id === selectedId
    const common = {
      key: a.id,
      onPointerDown: (e: React.PointerEvent) => {
        if (tool !== 'select') return
        e.stopPropagation()
        setSelected(a.id)
        ;(e.target as Element).setPointerCapture(e.pointerId)
        setMoving({ id: a.id, start: toPdf(e.clientX, e.clientY), orig: a, dx: 0, dy: 0 })
      },
      onDoubleClick: (e: React.MouseEvent) => {
        if (tool !== 'select') return
        if (a.type !== 'FreeText' && a.type !== 'Text') return
        e.stopPropagation()
        setEditing({
          id: a.id,
          type: a.type,
          rect: a.rect,
          content: a.type === 'FreeText' ? a.text?.content ?? '' : a.contents ?? '',
          style: a.style
        })
      },
      style: {
        cursor: tool === 'select' ? 'move' : 'default',
        pointerEvents: (editMode ? 'auto' : 'none') as React.CSSProperties['pointerEvents']
      }
    }
    const [x0, y0, x1, y1] = a.rect
    const sel = isSelected ? { strokeDasharray: '4 2' } : {}

    if (a.type === 'Square') {
      return (
        <rect
          {...common}
          x={x0 * scale}
          y={y0 * scale}
          width={(x1 - x0) * scale}
          height={(y1 - y0) * scale}
          fill={rgbToCss(a.style.fill, a.style.opacity)}
          stroke={rgbToCss(a.style.stroke, 1)}
          strokeWidth={a.style.width * scale}
          {...sel}
        />
      )
    }
    if (a.type === 'Circle') {
      return (
        <ellipse
          {...common}
          cx={((x0 + x1) / 2) * scale}
          cy={((y0 + y1) / 2) * scale}
          rx={((x1 - x0) / 2) * scale}
          ry={((y1 - y0) / 2) * scale}
          fill={rgbToCss(a.style.fill, a.style.opacity)}
          stroke={rgbToCss(a.style.stroke, 1)}
          strokeWidth={a.style.width * scale}
          {...sel}
        />
      )
    }
    if (a.type === 'Line' && a.line) {
      return (
        <line
          {...common}
          x1={a.line[0][0] * scale}
          y1={a.line[0][1] * scale}
          x2={a.line[1][0] * scale}
          y2={a.line[1][1] * scale}
          stroke={rgbToCss(a.style.stroke, 1)}
          strokeWidth={a.style.width * scale}
          {...sel}
        />
      )
    }
    if (a.type === 'Ink' && a.ink) {
      return (
        <g {...common}>
          {a.ink.map((stroke, i) => (
            <polyline
              key={i}
              points={stroke.map(([x, y]) => `${x * scale},${y * scale}`).join(' ')}
              fill="none"
              stroke={rgbToCss(a.style.stroke, a.style.opacity)}
              strokeWidth={a.style.width * scale}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        </g>
      )
    }
    if (a.type === 'Highlight' && a.quads) {
      return (
        <g {...common}>
          {a.quads.map((q, i) => (
            // Quad order per PDF spec: UL, UR, LL, LR.
            <polygon
              key={i}
              points={`${q[0] * scale},${q[1] * scale} ${q[2] * scale},${q[3] * scale} ${q[6] * scale},${q[7] * scale} ${q[4] * scale},${q[5] * scale}`}
              fill={rgbToCss(a.style.stroke, a.style.opacity)}
            />
          ))}
        </g>
      )
    }
    if ((a.type === 'Underline' || a.type === 'StrikeOut') && a.quads) {
      const strokeW = Math.max(1, a.style.width || 1.5) * scale
      return (
        <g {...common}>
          {/* Invisible fat hit-area so the thin line is still easy to click/select. */}
          {a.quads.map((q, i) => (
            <rect
              key={`hit-${i}`}
              x={Math.min(q[0], q[4]) * scale}
              y={Math.min(q[1], q[3]) * scale}
              width={(Math.max(q[2], q[6]) - Math.min(q[0], q[4])) * scale}
              height={(Math.max(q[5], q[7]) - Math.min(q[1], q[3])) * scale}
              fill="transparent"
            />
          ))}
          {a.quads.map((q, i) => {
            const y = a.type === 'Underline' ? [q[5], q[7]] : [(q[1] + q[5]) / 2, (q[3] + q[7]) / 2]
            return (
              <line
                key={i}
                x1={q[0] * scale}
                y1={y[0] * scale}
                x2={q[2] * scale}
                y2={y[1] * scale}
                stroke={rgbToCss(a.style.stroke, a.style.opacity)}
                strokeWidth={strokeW}
              />
            )
          })}
        </g>
      )
    }
    if (a.type === 'FreeText') {
      return (
        <g {...common}>
          <rect
            x={x0 * scale}
            y={y0 * scale}
            width={(x1 - x0) * scale}
            height={(y1 - y0) * scale}
            fill={rgbToCss(a.style.fill, 1)}
            stroke={isSelected ? '#4c8bf5' : rgbToCss(a.style.stroke, 1)}
            strokeWidth={Math.max(a.style.width, isSelected ? 1 : 0) * scale}
          />
          <foreignObject x={x0 * scale} y={y0 * scale} width={(x1 - x0) * scale} height={(y1 - y0) * scale}>
            <div
              style={{
                fontSize: (a.text?.size ?? 12) * scale,
                color: rgbToCss(a.text?.color ?? [0, 0, 0], 1),
                padding: 2,
                fontFamily: 'sans-serif',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                pointerEvents: 'none'
              }}
            >
              {a.text?.content}
            </div>
          </foreignObject>
        </g>
      )
    }
    if (a.type === 'Text') {
      return (
        <g {...common}>
          <rect
            x={x0 * scale}
            y={y0 * scale}
            width={(x1 - x0) * scale}
            height={(y1 - y0) * scale}
            fill={rgbToCss(a.style.stroke, 1)}
            stroke={isSelected ? '#4c8bf5' : '#333'}
          />
          <title>{a.contents}</title>
        </g>
      )
    }
    return <g key={a.id} />
  }

  const renderHandles = (): React.ReactElement | null => {
    if (!editMode || tool !== 'select' || !selectedId || editing) return null
    const base = (annots ?? []).find((a) => a.id === selectedId)
    if (!base || !RESIZABLE.has(base.type)) return null
    const a = moving?.id === base.id ? { ...base, ...dragPatch(moving.orig, moving.dx, moving.dy, moving.handle) } : base
    const [x0, y0, x1, y1] = a.rect
    const mx = (x0 + x1) / 2
    const my = (y0 + y1) / 2
    const pos: Partial<Record<Handle, [number, number]>> =
      a.type === 'Line' && a.line
        ? { p0: a.line[0], p1: a.line[1] }
        : { nw: [x0, y0], n: [mx, y0], ne: [x1, y0], e: [x1, my], se: [x1, y1], s: [mx, y1], sw: [x0, y1], w: [x0, my] }
    const cursor = (h: Handle): string =>
      h === 'p0' || h === 'p1' ? 'crosshair' : h === 'n' || h === 's' ? 'ns-resize' : h === 'e' || h === 'w' ? 'ew-resize' : h === 'nw' || h === 'se' ? 'nwse-resize' : 'nesw-resize'
    const S = 8
    return (
      <g>
        {(a.type === 'Line' ? (['p0', 'p1'] as Handle[]) : RECT_HANDLES).map((h) => {
          const [hx, hy] = pos[h]!
          return (
            <rect
              key={h}
              x={hx * scale - S / 2}
              y={hy * scale - S / 2}
              width={S}
              height={S}
              fill="#fff"
              stroke="#4c8bf5"
              strokeWidth={1.5}
              style={{ cursor: cursor(h), pointerEvents: 'auto' }}
              onPointerDown={(e) => {
                e.stopPropagation()
                ;(e.target as Element).setPointerCapture(e.pointerId)
                setMoving({ id: base.id, start: toPdf(e.clientX, e.clientY), orig: base, dx: 0, dy: 0, handle: h })
              }}
            />
          )
        })}
      </g>
    )
  }

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      style={{
        position: 'absolute',
        inset: 0,
        cursor: isDrawTool ? 'crosshair' : 'default',
        // In select mode — and while a highlighter-style mark tool is
        // armed — the background must be click-through so real text
        // selection on the layer underneath works (SelectionToolbar does
        // the marking on pointerup). Individual shapes opt back in via
        // pointerEvents:'auto' (see `common` below).
        pointerEvents: !editMode || tool === 'select' || MARK_TYPES.has(tool) ? 'none' : 'auto'
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {(annots ?? []).map((a) =>
        moving?.id === a.id ? renderShape({ ...a, ...dragPatch(moving.orig, moving.dx, moving.dy, moving.handle) }) : renderShape(a)
      )}
      {renderHandles()}
      {drag && tool === 'Ink' && (
        <polyline
          points={drag.ink.map(([x, y]) => `${x * scale},${y * scale}`).join(' ')}
          fill="none"
          stroke={rgbToCss(styles.Ink?.stroke ?? [0, 0, 0], 1)}
          strokeWidth={(styles.Ink?.width ?? 2) * scale}
        />
      )}
      {drag && tool !== 'Ink' && (
        <rect
          x={Math.min(drag.start[0], drag.cur[0]) * scale}
          y={Math.min(drag.start[1], drag.cur[1]) * scale}
          width={Math.abs(drag.cur[0] - drag.start[0]) * scale}
          height={Math.abs(drag.cur[1] - drag.start[1]) * scale}
          fill="rgba(76,139,245,0.15)"
          stroke="#4c8bf5"
          strokeDasharray="4 2"
        />
      )}
      {editing && (
        <foreignObject
          x={editing.rect[0] * scale}
          y={editing.rect[1] * scale}
          width={(editing.rect[2] - editing.rect[0]) * scale}
          height={(editing.rect[3] - editing.rect[1]) * scale}
        >
          <textarea
            autoFocus
            value={editing.content}
            placeholder={editing.type === 'FreeText' ? '텍스트 입력...' : '메모 입력...'}
            onChange={(e) => setEditing((s) => (s ? { ...s, content: e.target.value } : s))}
            onFocus={(e) => e.currentTarget.select()}
            onBlur={() => void commitEdit()}
            onKeyDown={(e) => {
              e.stopPropagation()
              if (e.key === 'Escape') {
                editCancelledRef.current = true
                setEditing(null)
                useToolStore.getState().setTool('select')
              }
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault()
                e.currentTarget.blur()
              }
            }}
            style={{
              width: '100%',
              height: '100%',
              boxSizing: 'border-box',
              resize: 'none',
              border: '2px solid #4c8bf5',
              borderRadius: 2,
              padding: 4,
              fontSize: Math.max(12, 12 * scale),
              fontFamily: 'sans-serif',
              color: '#111',
              background: editing.type === 'FreeText' ? rgbToCss(editing.style.fill, 1) : '#fff9d6',
              outline: 'none'
            }}
          />
        </foreignObject>
      )}
    </svg>
  )
}

export type { ToolId }
