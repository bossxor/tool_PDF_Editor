import React, { useRef, useState } from 'react'
import { useTab } from '../tabs/TabContext'
import type { SearchHit } from '../../../shared/types'
import { IconSearch, IconChevronUp, IconChevronDown, IconClose } from '../ui/icons'

export default function SearchBar({ onClose }: { onClose: () => void }): React.ReactElement {
  const { api, useDocStore } = useTab()
  const info = useDocStore((s) => s.info)
  const search = useDocStore((s) => s.search)
  const setSearch = useDocStore((s) => s.setSearch)
  const [query, setQuery] = useState('')
  const lastQuery = useRef('')
  const hits = search?.hits ?? []
  const index = search?.index ?? 0

  // Pages are virtualized, so the target may not be mounted: derive the
  // scroll position from page sizes instead of looking the element up.
  const goTo = (hit: SearchHit): void => {
    const viewer = document.querySelector('.viewer') as HTMLElement | null
    const content = document.querySelector('.viewer-content') as HTMLElement | null
    const anyPage = content?.querySelector('.page') as HTMLElement | null
    if (!viewer || !content || !anyPage || !info) return
    const scale = anyPage.getBoundingClientRect().width / info.pages[Number(anyPage.dataset.page)].width
    let y = content.getBoundingClientRect().top - viewer.getBoundingClientRect().top + viewer.scrollTop
    for (let i = 0; i < hit.page; i++) y += info.pages[i].height * scale + 12
    const top = Math.min(...hit.quads.flatMap((q) => [q[1], q[3], q[5], q[7]]))
    viewer.scrollTop = y + top * scale - viewer.clientHeight / 3
  }

  const runSearch = async (): Promise<void> => {
    if (!query.trim()) {
      setSearch(null)
      return
    }
    lastQuery.current = query
    const result = await api.search(query)
    setSearch(result.length ? { hits: result, index: 0 } : null)
    if (result.length > 0) goTo(result[0])
  }

  const next = (dir: 1 | -1): void => {
    if (hits.length === 0) return
    const n = (index + dir + hits.length) % hits.length
    setSearch({ hits, index: n })
    goTo(hits[n])
  }

  const close = (): void => {
    setSearch(null)
    onClose()
  }

  return (
    <div className="search-bar">
      <IconSearch size={15} className="tab-icon" />
      <input
        autoFocus
        value={query}
        placeholder="검색어 입력"
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.shiftKey ? next(-1) : hits.length && query === lastQuery.current ? next(1) : runSearch()
          if (e.key === 'Escape') close()
        }}
      />
      <button className="wide" onClick={runSearch}>
        검색
      </button>
      <span className="search-count">
        {hits.length > 0 ? `${index + 1} / ${hits.length}건` : ''}
      </span>
      <button onClick={() => next(-1)} disabled={hits.length === 0} title="이전 결과">
        <IconChevronUp size={15} />
      </button>
      <button onClick={() => next(1)} disabled={hits.length === 0} title="다음 결과">
        <IconChevronDown size={15} />
      </button>
      <button onClick={close} title="닫기 (Esc)">
        <IconClose size={14} />
      </button>
    </div>
  )
}
