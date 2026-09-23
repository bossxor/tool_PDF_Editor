import React from 'react'
import type { TabBundle } from './TabContext'
import { IconClose, IconPlus, IconFileText, IconLock } from '../ui/icons'

function basename(p: string | null): string {
  if (!p) return '새 탭'
  const parts = p.split(/[\\/]/)
  return parts[parts.length - 1] || p
}

function TabLabel({ bundle }: { bundle: TabBundle }): React.ReactElement {
  const filePath = bundle.useDocStore((s) => s.filePath)
  const loading = bundle.useDocStore((s) => s.loading)
  const encrypted = bundle.useDocStore((s) => s.info?.encrypted ?? false)
  const dirty = bundle.useAnnotStore((s) => s.dirty)
  return (
    <>
      <span className="tab-icon">{encrypted ? <IconLock size={13} /> : <IconFileText size={13} />}</span>
      <span className="tab-label" title={filePath ?? ''}>
        {loading ? '여는 중...' : basename(filePath)}
        {dirty ? ' •' : ''}
      </span>
    </>
  )
}

export default function TabBar({
  tabs,
  activeId,
  onSelect,
  onClose,
  onNewTab
}: {
  tabs: { id: string; bundle: TabBundle }[]
  activeId: string | null
  onSelect: (id: string) => void
  onClose: (id: string) => void
  onNewTab: () => void
}): React.ReactElement {
  return (
    <div className="tab-bar">
      {tabs.map((t) => (
        <div
          key={t.id}
          className={`tab-item ${t.id === activeId ? 'active' : ''}`}
          onClick={() => onSelect(t.id)}
          onMouseDown={(e) => {
            if (e.button === 1) {
              e.preventDefault()
              onClose(t.id)
            }
          }}
        >
          <TabLabel bundle={t.bundle} />
          <button
            className="tab-close"
            onClick={(e) => {
              e.stopPropagation()
              onClose(t.id)
            }}
          >
            <IconClose size={12} />
          </button>
        </div>
      ))}
      <button className="tab-new" onClick={onNewTab} title="파일 열기 (Ctrl+O)">
        <IconPlus size={15} />
      </button>
    </div>
  )
}
