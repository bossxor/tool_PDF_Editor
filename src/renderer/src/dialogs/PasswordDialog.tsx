import React from 'react'
import { useState } from 'react'

export default function PasswordDialog({
  error,
  onSubmit,
  onCancel
}: {
  error: string | null
  onSubmit: (pw: string) => void
  onCancel: () => void
}): React.ReactElement {
  const [pw, setPw] = useState('')

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h3>비밀번호가 필요합니다</h3>
        <input
          type="password"
          autoFocus
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSubmit(pw)
            if (e.key === 'Escape') onCancel()
          }}
        />
        {error && <p className="error-text">{error}</p>}
        <div className="modal-actions">
          <button onClick={onCancel}>취소</button>
          <button onClick={() => onSubmit(pw)} className="primary">
            확인
          </button>
        </div>
      </div>
    </div>
  )
}
