import React, { useState } from 'react'

export type EncryptionChoice = 'keep' | 'none' | 'new'

export default function SaveOptionsDialog({
  wasEncrypted,
  onCancel,
  onConfirm
}: {
  wasEncrypted: boolean
  onCancel: () => void
  onConfirm: (encryption: 'keep' | 'none' | { userPassword: string; ownerPassword?: string }) => void
}): React.ReactElement {
  const [choice, setChoice] = useState<EncryptionChoice>(wasEncrypted ? 'keep' : 'none')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = (): void => {
    if (choice === 'new') {
      if (pw.length === 0) {
        setError('비밀번호를 입력하세요.')
        return
      }
      if (pw.includes(',')) {
        // MuPDF's save options are a comma-separated string; a comma here
        // would split the password and silently break encryption.
        setError('비밀번호에 쉼표(,)는 사용할 수 없습니다.')
        return
      }
      if (pw !== pw2) {
        setError('비밀번호가 일치하지 않습니다.')
        return
      }
      onConfirm({ userPassword: pw })
      return
    }
    onConfirm(choice)
  }

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h3>다른 이름으로 저장</h3>
        <div className="radio-group">
          {wasEncrypted && (
            <label>
              <input type="radio" checked={choice === 'keep'} onChange={() => setChoice('keep')} /> 원래 암호 유지
            </label>
          )}
          <label>
            <input type="radio" checked={choice === 'none'} onChange={() => setChoice('none')} /> 암호 없음
          </label>
          <label>
            <input type="radio" checked={choice === 'new'} onChange={() => setChoice('new')} /> 새 암호 설정
          </label>
        </div>
        {choice === 'new' && (
          <div className="new-pw">
            <input type="password" placeholder="새 비밀번호" value={pw} onChange={(e) => setPw(e.target.value)} />
            <input
              type="password"
              placeholder="비밀번호 확인"
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
            />
          </div>
        )}
        {error && <p className="error-text">{error}</p>}
        <div className="modal-actions">
          <button onClick={onCancel}>취소</button>
          <button className="primary" onClick={submit}>
            저장
          </button>
        </div>
      </div>
    </div>
  )
}
