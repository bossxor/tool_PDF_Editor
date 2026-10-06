import React from 'react'
import { useTab } from '../tabs/TabContext'
import type { AnnotStyle, RGB } from '../../../shared/types'

function ColorField({
  label,
  value,
  onChange,
  allowNone
}: {
  label: string
  value: RGB
  onChange: (c: RGB) => void
  allowNone?: boolean
}): React.ReactElement {
  const hex = value
    ? '#' + value.map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('')
    : '#ffffff'
  return (
    <label className="field">
      <span>{label}</span>
      <div className="color-row">
        <input
          type="color"
          value={hex}
          onChange={(e) => {
            const v = e.target.value
            const r = parseInt(v.slice(1, 3), 16) / 255
            const g = parseInt(v.slice(3, 5), 16) / 255
            const b = parseInt(v.slice(5, 7), 16) / 255
            onChange([r, g, b])
          }}
        />
        {allowNone && (
          <button className={value === null ? 'active' : ''} onClick={() => onChange(null)}>
            없음
          </button>
        )}
      </div>
    </label>
  )
}

export default function PropertyPanel(): React.ReactElement | null {
  const { useToolStore, useAnnotStore, useDocStore } = useTab()
  const tool = useToolStore((s) => s.tool)
  const styles = useToolStore((s) => s.styles)
  const setStyle = useToolStore((s) => s.setStyle)
  const selectedId = useToolStore((s) => s.selectedAnnotId)
  const editMode = useDocStore((s) => s.editMode)
  const byPage = useAnnotStore((s) => s.byPage)
  const updateAnnot = useAnnotStore((s) => s.update)
  const removeAnnot = useAnnotStore((s) => s.remove)

  // The selection can live on any visible page, not just the "current" one.
  const selected = selectedId ? Object.values(byPage).flat().find((a) => a.id === selectedId) ?? null : null
  const target = selected?.type ?? (tool !== 'select' && tool !== 'pan' ? tool : null)
  if (!editMode || !target) return null

  const style: AnnotStyle = selected?.style ?? styles[target] ?? { stroke: [0, 0, 0], fill: null, width: 1, opacity: 1 }

  const apply = (patch: Partial<AnnotStyle>): void => {
    if (selected) void updateAnnot(selected.page, selected.id, { style: { ...style, ...patch } })
    else setStyle(target, patch)
  }

  const hasFill = ['Square', 'Circle', 'FreeText'].includes(target)
  const hasStroke = true
  const hasWidth = !['Highlight'].includes(target)

  return (
    <aside className="property-panel">
      <h4>{selected ? '주석 속성' : '도구 스타일'}</h4>
      {hasStroke && (
        <ColorField
          label={target === 'FreeText' ? '테두리 색' : '테두리/선 색'}
          value={style.stroke}
          onChange={(c) => apply({ stroke: c })}
          allowNone
        />
      )}
      {hasFill && (
        <ColorField
          label={target === 'FreeText' ? '배경색' : '채우기 색'}
          value={style.fill}
          onChange={(c) => apply({ fill: c })}
          allowNone
        />
      )}
      {hasWidth && (
        <label className="field">
          <span>두께 {style.width.toFixed(1)}pt</span>
          <input
            type="range"
            min={0}
            max={20}
            step={0.5}
            value={style.width}
            onChange={(e) => apply({ width: Number(e.target.value) })}
          />
        </label>
      )}
      <label className="field">
        <span>투명도 {Math.round(style.opacity * 100)}%</span>
        <input
          type="range"
          min={0.1}
          max={1}
          step={0.05}
          value={style.opacity}
          onChange={(e) => apply({ opacity: Number(e.target.value) })}
        />
      </label>
      {selected?.type === 'FreeText' && selected.text && (
        <>
          <ColorField
            label="글자색"
            value={selected.text.color ?? [0, 0, 0]}
            onChange={(c) => void updateAnnot(selected.page, selected.id, { text: { ...selected.text!, color: c } })}
          />
          <label className="field">
            <span>글자 크기 {selected.text.size}pt</span>
            <input
              type="range"
              min={8}
              max={48}
              step={1}
              value={selected.text.size}
              onChange={(e) =>
                void updateAnnot(selected.page, selected.id, { text: { ...selected.text!, size: Number(e.target.value) } })
              }
            />
          </label>
        </>
      )}
      {selected && (
        <button
          className="danger"
          onClick={() => {
            void removeAnnot(selected.page, selected.id)
          }}
        >
          삭제
        </button>
      )}
    </aside>
  )
}
