import React from 'react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useTab } from '../tabs/TabContext'
import PageView from './PageView'

const PAGE_GAP = 12
const OVERSCAN = 2

export default function Viewer(): React.ReactElement {
  const { api, useDocStore } = useTab()
  const info = useDocStore((s) => s.info)
  const loading = useDocStore((s) => s.loading)
  const needsPassword = useDocStore((s) => s.needsPassword)
  const [contentVersion, setContentVersion] = useState(0)
  const zoom = useDocStore((s) => s.zoom)
  const fitMode = useDocStore((s) => s.fitMode)
  const twoPage = useDocStore((s) => s.twoPage)
  const setCurrentPage = useDocStore((s) => s.setCurrentPage)
  const setZoom = useDocStore((s) => s.setZoom)
  const pageRequest = useDocStore((s) => s.pageRequest)

  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(800)
  const [scrollTop, setScrollTop] = useState(0)
  const scrollPosition = useRef(0)
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
  }, [!!info])

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

  const previousLayout = useRef({ info, layout })
  useLayoutEffect(() => {
    const previous = previousLayout.current
    previousLayout.current = { info, layout }
    const el = containerRef.current
    if (!el || previous.info !== info || pageRequest || previous.layout === layout) return
    const old = previous.layout
    const page = old.offsets.findIndex((off, i) => off + old.sizes[i].h > scrollPosition.current + 4)
    if (page < 0 || !layout.sizes[page]) return
    const fraction = (scrollPosition.current - old.offsets[page]) / old.sizes[page].h
    el.scrollTop = layout.offsets[page] + fraction * layout.sizes[page].h
    scrollPosition.current = el.scrollTop
    setScrollTop(el.scrollTop)
    setCurrentPage(page)
  }, [layout, info, pageRequest])

  useEffect(() => {
    useDocStore.setState({ renderedZoom: effectiveZoom })
  }, [effectiveZoom, useDocStore])

  useEffect(() => {
    const el = containerRef.current
    if (!el || !pageRequest || layout.offsets.length === 0) return
    const page = Math.max(0, Math.min(pageRequest.page, layout.offsets.length - 1))
    el.scrollTop = layout.offsets[page] + pageRequest.y * effectiveZoom
    scrollPosition.current = el.scrollTop
    setScrollTop(el.scrollTop)
    setCurrentPage(page)
    useDocStore.setState({ pageRequest: null })
  }, [pageRequest, layout, effectiveZoom, setCurrentPage, useDocStore])

  const onScroll = (): void => {
    const el = containerRef.current
    if (!el) return
    scrollPosition.current = el.scrollTop
    setScrollTop(el.scrollTop)
    // Update current page = first page whose bottom is past the viewport top
    const idx = layout.offsets.findIndex((off, i) => off + layout.sizes[i].h > el.scrollTop + 4)
    if (idx >= 0) setCurrentPage(idx)
  }

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    let nextZoom = effectiveZoom
    const onWheel = (e: WheelEvent): void => {
      if (!e.ctrlKey || e.deltaY === 0) return
      e.preventDefault()
      nextZoom = Math.min(8, Math.max(0.1, nextZoom + (e.deltaY > 0 ? -0.1 : 0.1)))
      setZoom(nextZoom)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [effectiveZoom, setZoom, !!info])

  if (!info) {
    return <div className="viewer-empty"><span className="empty-document">PDF</span><strong>{loading ? '문서를 불러오는 중…' : needsPassword ? '암호를 입력하면 문서가 열립니다' : '문서를 열 수 없습니다'}</strong><span>다른 문서를 열려면 Ctrl+O를 누르세요</span></div>
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
    <div className="viewer" ref={containerRef} onScroll={onScroll} style={{ overflowAnchor: 'none' }}>
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
                visible={layout.offsets[i] + h > scrollTop && layout.offsets[i] < scrollTop + viewportHeight}
                copyAllowed={info.permissions.copy}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
