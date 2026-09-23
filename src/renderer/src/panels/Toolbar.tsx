import React from 'react'
import { useTab } from '../tabs/TabContext'
import type { ToolId } from '../store/toolStore'
import {
  IconOpen,
  IconSave,
  IconSaveAs,
  IconPrint,
  IconUndo,
  IconRedo,
  IconSelect,
  IconSquare,
  IconCircle,
  IconLine,
  IconPen,
  IconTextBox,
  IconNote,
  IconChevronLeft,
  IconChevronRight,
  IconMinus,
  IconPlus
} from '../ui/icons'

// Highlight/Underline/StrikeOut are no longer here — they're applied from
// the floating toolbar that appears when text is selected (see
// viewer/SelectionToolbar.tsx), Adobe Acrobat-style, instead of a
// dedicated "arm the tool, then drag a box" flow.
const TOOLS: { id: ToolId; icon: React.FC<{ size?: number }>; title: string }[] = [
  { id: 'select', icon: IconSelect, title: '선택 (V)' },
  { id: 'Square', icon: IconSquare, title: '사각형 (R)' },
  { id: 'Circle', icon: IconCircle, title: '원 (O)' },
  { id: 'Line', icon: IconLine, title: '선 (L)' },
  { id: 'Ink', icon: IconPen, title: '펜 (P)' },
  { id: 'FreeText', icon: IconTextBox, title: '텍스트 상자 (X)' },
  { id: 'Text', icon: IconNote, title: '메모 (N)' }
]

export default function Toolbar({
  onOpen,
  onSave,
  onSaveAs,
  onPrint
}: {
  onOpen: () => void
  onSave: () => void
  onSaveAs: () => void
  onPrint: () => void
}): React.ReactElement {
  const { useDocStore, useToolStore, useAnnotStore } = useTab()
  const info = useDocStore((s) => s.info)
  const currentPage = useDocStore((s) => s.currentPage)
  const setCurrentPage = useDocStore((s) => s.setCurrentPage)
  const zoom = useDocStore((s) => s.zoom)
  const fitMode = useDocStore((s) => s.fitMode)
  const setZoom = useDocStore((s) => s.setZoom)
  const setFitMode = useDocStore((s) => s.setFitMode)

  const tool = useToolStore((s) => s.tool)
  const setTool = useToolStore((s) => s.setTool)
  const canUndo = useAnnotStore((s) => s.canUndo)
  const canRedo = useAnnotStore((s) => s.canRedo)
  const undo = useAnnotStore((s) => s.undo)
  const redo = useAnnotStore((s) => s.redo)
  const dirty = useAnnotStore((s) => s.dirty)

  const goTo = (p: number): void => {
    const el = document.querySelector(`.page[data-page="${p}"]`)
    el?.scrollIntoView({ block: 'start' })
    setCurrentPage(p)
  }

  const canAnnotate = info?.permissions.annotate ?? false

  return (
    <div className="toolbar">
      <button className="wide" onClick={onOpen} title="파일 열기 (Ctrl+O)">
        <IconOpen size={16} /> 열기
      </button>
      <button className="wide" onClick={onSave} disabled={!info} title="저장 (Ctrl+S)">
        <IconSave size={16} /> 저장{dirty ? <span className="dirty-dot">●</span> : null}
      </button>
      <button onClick={onSaveAs} disabled={!info} title="다른 이름으로 저장 (Ctrl+Shift+S)">
        <IconSaveAs size={17} />
      </button>
      <button onClick={onPrint} disabled={!info || !info.permissions.print} title="인쇄 (Ctrl+P)">
        <IconPrint size={17} />
      </button>
      <div className="sep" />
      <button onClick={() => void undo()} disabled={!canUndo} title="실행 취소 (Ctrl+Z)">
        <IconUndo size={17} />
      </button>
      <button onClick={() => void redo()} disabled={!canRedo} title="다시 실행 (Ctrl+Y)">
        <IconRedo size={17} />
      </button>
      <div className="sep" />
      {TOOLS.map((t) => (
        <button
          key={t.id}
          title={t.title}
          className={tool === t.id ? 'active' : ''}
          disabled={!info || (t.id !== 'select' && !canAnnotate)}
          onClick={() => setTool(t.id)}
        >
          <t.icon size={17} />
        </button>
      ))}
      <div className="sep" />
      <button disabled={!info || currentPage <= 0} onClick={() => goTo(currentPage - 1)} title="이전 페이지">
        <IconChevronLeft size={17} />
      </button>
      <span className="page-indicator">{info ? `${currentPage + 1} / ${info.pageCount}` : '- / -'}</span>
      <button
        disabled={!info || currentPage >= (info?.pageCount ?? 1) - 1}
        onClick={() => goTo(currentPage + 1)}
        title="다음 페이지"
      >
        <IconChevronRight size={17} />
      </button>
      <div className="sep" />
      <button onClick={() => setZoom(zoom - 0.1)} disabled={!info} title="축소">
        <IconMinus size={16} />
      </button>
      <span className="zoom-indicator">{Math.round(zoom * 100)}%</span>
      <button onClick={() => setZoom(zoom + 0.1)} disabled={!info} title="확대">
        <IconPlus size={16} />
      </button>
      <select value={fitMode} onChange={(e) => setFitMode(e.target.value as 'width' | 'page' | 'custom')} disabled={!info}>
        <option value="width">폭 맞춤</option>
        <option value="page">페이지 맞춤</option>
        <option value="custom">사용자 지정</option>
      </select>
    </div>
  )
}
