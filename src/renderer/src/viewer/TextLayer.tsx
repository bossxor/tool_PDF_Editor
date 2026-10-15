import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { TabApi, TextLine } from '../../../shared/types'

interface Props {
  api: TabApi
  pageIndex: number
  scale: number
  visible: boolean
  copyAllowed: boolean
}

// Transparent text spans overlaid on the page bitmap so the browser's native
// selection/copy/find works. One span per extracted line (see engine.getTextLines).
export default function TextLayer({ api, pageIndex, scale, visible, copyAllowed }: Props): React.ReactElement | null {
  const [lines, setLines] = useState<TextLine[] | null>(null)

  useEffect(() => {
    if (!visible || !copyAllowed) return
    let cancelled = false
    api.getTextLines(pageIndex).then((l) => {
      if (!cancelled) setLines(l)
    })
    return () => {
      cancelled = true
    }
  }, [api, pageIndex, visible, copyAllowed])

  const layerRef = useRef<HTMLDivElement>(null)

  // Browser glyph widths never match the PDF font's, so stretch each line's
  // span to the exact PDF line width. Selection rects (and therefore marks)
  // then cover the real text at every zoom level instead of drifting.
  useLayoutEffect(() => {
    const spans = Array.from(layerRef.current?.querySelectorAll<HTMLSpanElement>('span') ?? [])
    spans.forEach(el => { el.style.transform = '' })
    const widths = spans.map(el => el.offsetWidth)
    spans.forEach((el, i) => {
      const target = Number(el.dataset.w)
      if (widths[i] > 0 && target > 0) el.style.transform = `scaleX(${target / widths[i]})`
    })
  }, [lines])

  if (!copyAllowed || !lines) return null

  return (
    <div ref={layerRef} className="text-layer" style={{ position: 'absolute', left: 0, top: 0, width: `${100 / scale}%`, height: `${100 / scale}%`, transform: `scale(${scale})`, transformOrigin: 'left top' }}>
      {lines.map((line, i) => {
        const [x0, y0, x1, y1] = line.bbox
        const w = x1 - x0
        const h = y1 - y0
        return (
          <span
            key={i}
            data-w={w}
            style={{
              position: 'absolute',
              left: x0,
              top: y0,
              height: h,
              fontSize: h,
              lineHeight: `${h}px`,
              whiteSpace: 'pre',
              color: 'transparent',
              transformOrigin: 'left top',
              cursor: 'text',
              userSelect: 'text'
            }}
          >
            {line.text}
          </span>
        )
      })}
    </div>
  )
}
