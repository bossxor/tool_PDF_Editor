import React, { useEffect } from 'react'
import { IconAlert } from '../ui/icons'

export interface ConfirmButton {
  key: string
  label: string
  variant?: 'primary' | 'danger'
}

export default function ConfirmDialog({
  title,
  message,
  items,
  buttons,
  onChoose
}: {
  title: string
  message?: string
  items?: string[]
  buttons: ConfirmButton[] // left to right; the last one is the Enter default, Esc picks the first
  onChoose: (key: string) => void
}): React.ReactElement {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onChoose(buttons[0].key)
      if (e.key === 'Enter') onChoose(buttons[buttons.length - 1].key)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [buttons, onChoose])

  return (
    <div className="modal-backdrop" onClick={() => onChoose(buttons[0].key)}>
      <div className="modal confirm" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-head">
          <span className="confirm-icon">
            <IconAlert size={20} />
          </span>
          <div>
            <h3>{title}</h3>
            {message && <p className="confirm-msg">{message}</p>}
          </div>
        </div>
        {items && items.length > 0 && (
          <ul className="confirm-items">
            {items.map((it) => (
              <li key={it}>{it}</li>
            ))}
          </ul>
        )}
        <div className="modal-actions">
          {buttons.map((b) => (
            <button key={b.key} className={b.variant ?? ''} onClick={() => onChoose(b.key)}>
              {b.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
