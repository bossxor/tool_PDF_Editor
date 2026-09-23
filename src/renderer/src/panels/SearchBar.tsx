import React, { useState } from 'react'
import { useTab } from '../tabs/TabContext'
import type { SearchHit } from '../../../shared/types'
import { IconSearch, IconChevronUp, IconChevronDown, IconClose } from '../ui/icons'

export default function SearchBar({ onClose }: { onClose: () => void }): React.ReactElement {
  const { api } = useTab()
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<SearchHit[]>([])
  const [index, setIndex] = useState(0)

  const runSearch = async (): Promise<void> => {
    if (!query.trim()) {
      setHits([])
      return
    }
    const result = await api.search(query)
    setHits(result)
    setIndex(0)
    if (result.length > 0) goTo(result[0].page)
  }

  const goTo = (page: number): void => {
    const el = document.querySelector(`.page[data-page="${page}"]`)
    el?.scrollIntoView({ block: 'start' })
  }

  const next = (dir: 1 | -1): void => {
    if (hits.length === 0) return
    const n = (index + dir + hits.length) % hits.length
    setIndex(n)
    goTo(hits[n].page)
  }

  const totalQuads = hits.reduce((sum, h) => sum + h.quads.length, 0)

  return (
    <div className="search-bar">
      <IconSearch size={15} className="tab-icon" />
      <input
        autoFocus
        value={query}
        placeholder="검색어 입력"
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.shiftKey ? next(-1) : hits.length ? next(1) : runSearch()
          if (e.key === 'Escape') onClose()
        }}
      />
      <button className="wide" onClick={runSearch}>
        검색
      </button>
      <span className="search-count">
        {hits.length > 0 ? `${index + 1} / ${hits.length}페이지 (총 ${totalQuads}건)` : ''}
      </span>
      <button onClick={() => next(-1)} disabled={hits.length === 0} title="이전 결과">
        <IconChevronUp size={15} />
      </button>
      <button onClick={() => next(1)} disabled={hits.length === 0} title="다음 결과">
        <IconChevronDown size={15} />
      </button>
      <button onClick={onClose} title="닫기 (Esc)">
        <IconClose size={14} />
      </button>
    </div>
  )
}
