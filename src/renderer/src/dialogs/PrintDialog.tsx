import React, { useState } from 'react'

export default function PrintDialog({
  currentPage,
  pageCount,
  onClose,
  onPrint
}: {
  currentPage: number
  pageCount: number
  onClose: () => void
  onPrint: (opts: { pages: string; includeAnnots: boolean; currentPage: number }) => void
}): React.ReactElement {
  const [mode, setMode] = useState<'all' | 'current' | 'range'>('all')
  const [range, setRange] = useState(`1-${pageCount}`)
  const [includeAnnots, setIncludeAnnots] = useState(true)
  const [printing, setPrinting] = useState(false)

  const submit = async (): Promise<void> => {
    setPrinting(true)
    const pages = mode === 'all' ? 'all' : mode === 'current' ? 'current' : range
    onPrint({ pages, includeAnnots, currentPage })
  }

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h3>인쇄</h3>
        <div className="radio-group">
          <label>
            <input type="radio" checked={mode === 'all'} onChange={() => setMode('all')} /> 전체 ({pageCount}페이지)
          </label>
          <label>
            <input type="radio" checked={mode === 'current'} onChange={() => setMode('current')} /> 현재 페이지 (
            {currentPage + 1})
          </label>
          <label>
            <input type="radio" checked={mode === 'range'} onChange={() => setMode('range')} /> 범위
          </label>
          {mode === 'range' && (
            <input value={range} onChange={(e) => setRange(e.target.value)} placeholder="예: 1-3,5" />
          )}
          <label>
            <input type="checkbox" checked={includeAnnots} onChange={(e) => setIncludeAnnots(e.target.checked)} />{' '}
            주석 포함
          </label>
        </div>
        <div className="modal-actions">
          <button onClick={onClose}>취소</button>
          <button className="primary" disabled={printing} onClick={() => void submit()}>
            {printing ? '준비 중...' : '인쇄'}
          </button>
        </div>
      </div>
    </div>
  )
}
