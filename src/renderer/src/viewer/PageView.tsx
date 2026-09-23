import React from 'react'
import { useEffect, useRef, useState } from 'react'
import type { TabApi } from '../../../shared/types'
import TextLayer from './TextLayer'
import AnnotLayer from './AnnotLayer'

interface Props {
  api: TabApi
  pageIndex: number
  width: number
  height: number
  scale: number
  visible: boolean
  copyAllowed: boolean
}

// Renders one page's bitmap. Only fetches from the engine while `visible`.
export default function PageView({ api, pageIndex, width, height, scale, visible, copyAllowed }: Props): React.ReactElement {
  const [url, setUrl] = useState<string | null>(null)
  const requestedScale = useRef(0)

  useEffect(() => {
    if (!visible) return
    if (requestedScale.current === scale && url) return
    let cancelled = false
    requestedScale.current = scale
    api.renderPage(pageIndex, scale).then((r) => {
      if (cancelled) return
      const blob = new Blob([r.png], { type: 'image/png' })
      const objUrl = URL.createObjectURL(blob)
      setUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return objUrl
      })
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageIndex, scale, visible])

  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="page" style={{ width, height, position: 'relative' }} data-page={pageIndex}>
      {url ? (
        <img src={url} width={width} height={height} draggable={false} alt={`페이지 ${pageIndex + 1}`} />
      ) : (
        <div className="page-placeholder" style={{ width, height }} />
      )}
      <TextLayer api={api} pageIndex={pageIndex} scale={scale} visible={visible} copyAllowed={copyAllowed} />
      {visible && <AnnotLayer pageIndex={pageIndex} width={width} height={height} scale={scale} />}
    </div>
  )
}
