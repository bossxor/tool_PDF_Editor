import React from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTab } from '../tabs/TabContext'
import PageView from './PageView'

const PAGE_GAP = 12
const OVERSCAN = 2

export default function Viewer(): React.ReactElement {
  const { api, useDocStore } = useTab()
  const info = useDocStore((s) => s.info)
  const [contentVersion, setContentVersion] = useState(0)
  const zoom = useDocStore((s) => s.zoom)
  const fitMode = useDocStore((s) => s.fitMode)
  const twoPage = useDocStore((s) => s.twoPage)
  const setCurrentPage = useDocStore((s) => s.setCurrentPage)
  const setZoom = useDocStore((s) => s.setZoom)

  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(800)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(600)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      setContainerWidth(el.clientWidth)
      setViewportHeight(el.clientHeight)
    })
    ro.observe(el)
    setContainerWidth(el.clientWidth)
    setViewportHeight(el.clientHeight)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    setContentVersion((v) => v + 1)
  }, [info])

  const effectiveZoom = useMemo(() => {
    if (!info || info.pages.length === 0) return zoom
    const cols = twoPage ? 2 : 1
    if (fitMode === 'width') {
      const maxPageWidth = Math.max(...info.pages.map((p) => p.width))
      return Math.max(0.1, (containerWidth - 32 - (cols - 1) * PAGE_GAP) / (cols * maxPageWidth))
    }
    if (fitMode === 'page') {
      const p = info.pages[0]
      return Math.max(
        0.1,
        Math.min((containerWidth - 32 - (cols - 1) * PAGE_GAP) / (cols * p.width), (viewportHeight - 32) / p.height)
      )
    }
    return zoom
  }, [fitMode, zoom, containerWidth, viewportHeight, info, twoPage])

  const layout = useMemo(() => {
    if (!info) return { total: 0, offsets: [] as number[], sizes: [] as { w: number; h: number }[] }
    let y = 0
    const offsets: number[] = []
    const sizes: { w: number; h: number }[] = []
    const n = info.pages.length
    // Facing pages: pages 0,1 share a row, 2,3 the next, ... A row is as tall as its taller page.
    const step = twoPage ? 2 : 1
    for (let i = 0; i < n; i += step) {
      let rowH = 0
      for (let j = i; j < Math.min(n, i + step); j++) {
        offsets.push(y)
        const w = info.pages[j].width * effectiveZoom
        const h = info.pages[j].height * effectiveZoom
        sizes.push({ w, h })
        rowH = Math.max(rowH, h)
      }
      y += rowH + PAGE_GAP
    }
    return { total: y, offsets, sizes }
  }, [info, effectiveZoom, twoPage])

  const onScroll = (): void => {
    const el = containerRef.current
    if (!el) return
    setScrollTop(el.scrollTop)
    // Update current page = first page whose bottom is past the viewport top
    const idx = layout.offsets.findIndex((off, i) => off + layout.sizes[i].h > el.scrollTop + 4)
    if (idx >= 0) setCurrentPage(idx)
  }

  const onWheel = (e: React.WheelEvent): void => {
    if (e.ctrlKey) {
      e.preventDefault()
      const delta = e.deltaY > 0 ? -0.1 : 0.1
      setZoom(Math.min(8, Math.max(0.1, effectiveZoom + delta)))
    }
  }

  if (!info) {
    return <div className="viewer-empty">PDF 파일을 열어주세요 (Ctrl+O)</div>
  }

  const first = Math.max(
    0,
    layout.offsets.findIndex((off, i) => off + layout.sizes[i].h > scrollTop) - OVERSCAN
  )
  let last = layout.offsets.length - 1
  for (let i = 0; i < layout.offsets.length; i++) {
    if (layout.offsets[i] > scrollTop + viewportHeight) {
      last = Math.min(layout.offsets.length - 1, i + OVERSCAN)
      break
    }
  }

  return (
    <div className="viewer" ref={containerRef} onScroll={onScroll} onWheel={onWheel}>
      <div className="viewer-content" style={{ height: layout.total }}>
        {info.pages.map((_, i) => {
          if (i < first || i > last) return null
          const { w, h } = layout.sizes[i]
          return (
            <div
              key={i}
              className="page-wrap"
              style={{
                position: 'absolute',
                top: layout.offsets[i],
                // facing pages meet at the centre line, PAGE_GAP apart
                left: twoPage && i % 2 === 1 ? `calc(50% + ${PAGE_GAP / 2}px)` : 0,
                right: twoPage && i % 2 === 0 ? `calc(50% + ${PAGE_GAP / 2}px)` : 0,
                display: 'flex',
                justifyContent: twoPage ? (i % 2 === 0 ? 'flex-end' : 'flex-start') : 'center'
              }}
            >
              <PageView
                key={`${i}-${contentVersion}`}
                api={api}
                pageIndex={i}
                width={w}
                height={h}
                scale={effectiveZoom}
                visible={true}
                copyAllowed={info.permissions.copy}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
