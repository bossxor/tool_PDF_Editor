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
    layerRef.current?.querySelectorAll<HTMLSpanElement>('span').forEach((el) => {
      el.style.transform = ''
      const natural = el.offsetWidth
      const target = Number(el.dataset.w)
      if (natural > 0 && target > 0) el.style.transform = `scaleX(${target / natural})`
    })
  }, [lines, scale])

  if (!copyAllowed || !lines) return null

  return (
    <div ref={layerRef} className="text-layer" style={{ position: 'absolute', inset: 0 }}>
      {lines.map((line, i) => {
        const [x0, y0, x1, y1] = line.bbox
        const w = (x1 - x0) * scale
        const h = (y1 - y0) * scale
        return (
          <span
            key={i}
            data-w={w}
            style={{
              position: 'absolute',
              left: x0 * scale,
              top: y0 * scale,
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
