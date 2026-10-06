import React, { useEffect, useState } from 'react'
import { useTab } from '../tabs/TabContext'
import type { ToolId } from '../store/toolStore'
import {
  IconColumns,
  IconOpen,
  IconSave,
  IconSaveAs,
  IconPrint,
  IconUndo,
  IconRedo,
  IconSelect,
  IconHighlighter,
  IconUnderline,
  IconStrikethrough,
  IconSquare,
  IconCircle,
  IconLine,
  IconPen,
  IconTextBox,
  IconNote,
  IconChevronLeft,
  IconChevronRight,
  IconMinus,
  IconPlus,
  IconMaximize,
  IconMinimize,
  IconEdit,
  IconEye
} from '../ui/icons'

// Highlight/Underline/StrikeOut: click the tool, then drag over text like a
// highlighter pen — each drag marks the text it crosses (real selection
// under the hood, not a drawn box) and the tool stays armed for the next
// drag. See SelectionToolbar, which does the actual marking on pointerup.
const TOOLS: { id: ToolId; icon: React.FC<{ size?: number }>; title: string }[] = [
  { id: 'select', icon: IconSelect, title: '선택 (V)' },
  { id: 'Highlight', icon: IconHighlighter, title: '형광펜 (드래그로 계속 칠하기)' },
  { id: 'Underline', icon: IconUnderline, title: '밑줄' },
  { id: 'StrikeOut', icon: IconStrikethrough, title: '취소선' },
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
  const twoPage = useDocStore((s) => s.twoPage)
  const setTwoPage = useDocStore((s) => s.setTwoPage)
  const setZoom = useDocStore((s) => s.setZoom)
  const setFitMode = useDocStore((s) => s.setFitMode)
  const editMode = useDocStore((s) => s.editMode)
  const setEditMode = useDocStore((s) => s.setEditMode)

  const tool = useToolStore((s) => s.tool)
  const setTool = useToolStore((s) => s.setTool)
  const canUndo = useAnnotStore((s) => s.canUndo)
  const canRedo = useAnnotStore((s) => s.canRedo)
  const undo = useAnnotStore((s) => s.undo)
  const redo = useAnnotStore((s) => s.redo)
  const dirty = useAnnotStore((s) => s.dirty)

  const [fullscreen, setFullscreen] = useState(false)
  useEffect(() => {
    window.api.onFullscreenChange(setFullscreen)
  }, [])

  const goTo = (p: number): void => {
    const el = document.querySelector(`.page[data-page="${p}"]`)
    el?.scrollIntoView({ block: 'start' })
    setCurrentPage(p)
  }

  const canAnnotate = info?.permissions.annotate ?? false

  const toggleEditMode = (): void => {
    if (editMode) setTool('select')
    setEditMode(!editMode)
  }

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

      {editMode && (
        <>
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
        </>
      )}

      <div className="sep" />
      <button disabled={!info || currentPage <= 0} onClick={() => goTo(currentPage - 1)} title="이전 페이지">
        <IconChevronLeft size={17} />
      </button>
      <span className="page-indicator">
        {info ? (
          <>
            <input
              key={currentPage}
              className="page-input"
              defaultValue={currentPage + 1}
              title="페이지 번호 입력 후 Enter"
              onFocus={(e) => e.currentTarget.select()}
              onKeyDown={(e) => {
                e.stopPropagation()
                if (e.key !== 'Enter') return
                const n = parseInt(e.currentTarget.value, 10)
                if (n >= 1) goTo(Math.min(n, info.pageCount) - 1)
                e.currentTarget.blur()
              }}
            />{' '}
            / {info.pageCount}
          </>
        ) : (
          '- / -'
        )}
      </span>
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
      <button className={twoPage ? 'active' : ''} onClick={() => setTwoPage(!twoPage)} disabled={!info} title="두 페이지씩 보기">
        <IconColumns size={17} />
      </button>

      <div className="toolbar-spacer" />

      <button onClick={() => void window.api.toggleFullscreen()} title={fullscreen ? '전체화면 종료 (F11)' : '전체화면 (F11)'}>
        {fullscreen ? <IconMinimize size={17} /> : <IconMaximize size={17} />}
      </button>
      <button
        className={`wide ${editMode ? 'active' : ''}`}
        onClick={toggleEditMode}
        disabled={!info}
        title={editMode ? '뷰어로 돌아가기' : '편집 모드로 전환'}
      >
        {editMode ? <IconEye size={16} /> : <IconEdit size={16} />}
        {editMode ? '뷰어로' : '편집'}
      </button>
    </div>
  )
}
