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
    if (fitMode === 'width') {
      const maxPageWidth = Math.max(...info.pages.map((p) => p.width))
      return Math.max(0.1, (containerWidth - 32) / maxPageWidth)
    }
    if (fitMode === 'page') {
      const p = info.pages[0]
      return Math.max(0.1, Math.min((containerWidth - 32) / p.width, (viewportHeight - 32) / p.height))
    }
    return zoom
  }, [fitMode, zoom, containerWidth, viewportHeight, info])

  const layout = useMemo(() => {
    if (!info) return { total: 0, offsets: [] as number[], sizes: [] as { w: number; h: number }[] }
    let y = 0
    const offsets: number[] = []
    const sizes: { w: number; h: number }[] = []
    for (const p of info.pages) {
      offsets.push(y)
      const w = p.width * effectiveZoom
      const h = p.height * effectiveZoom
      sizes.push({ w, h })
      y += h + PAGE_GAP
    }
    return { total: y, offsets, sizes }
  }, [info, effectiveZoom])

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
            <div key={i} className="page-wrap" style={{ position: 'absolute', top: layout.offsets[i], left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
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
