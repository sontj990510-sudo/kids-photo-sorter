import { useEffect, useMemo, useState } from 'react'
import { Icon } from './Icon'
import type { SafetyAction } from '../types'

type SafetyDialogProps = {
  action: SafetyAction | null
  onCancel: () => void
  onConfirm: (action: SafetyAction) => void
}

export function SafetyDialog({
  action,
  onCancel,
  onConfirm,
}: SafetyDialogProps) {
  if (!action) {
    return null
  }

  return (
    <OpenSafetyDialog
      action={action}
      key={`${action.title}-${action.targetLabel}`}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  )
}

function OpenSafetyDialog({
  action,
  onCancel,
  onConfirm,
}: {
  action: SafetyAction
  onCancel: () => void
  onConfirm: (action: SafetyAction) => void
}) {
  const [typedValue, setTypedValue] = useState('')
  const [understood, setUnderstood] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(3)

  useEffect(() => {
    if (secondsLeft <= 0) {
      return
    }

    const timer = window.setTimeout(() => {
      setSecondsLeft((current) => Math.max(0, current - 1))
    }, 1000)

    return () => window.clearTimeout(timer)
  }, [action, secondsLeft])

  const canConfirm = useMemo(
    () =>
      understood &&
      secondsLeft === 0 &&
      typedValue.trim() === action.confirmationText,
    [action, secondsLeft, typedValue, understood],
  )

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCancel()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [action, onCancel])

  return (
    <div className="dialog-overlay" role="presentation">
      <section
        aria-describedby="safety-dialog-description"
        aria-labelledby="safety-dialog-title"
        aria-modal="true"
        className="safety-dialog"
        role="dialog"
      >
        <header>
          <span className="warning-icon">
            <Icon name="warning" size={25} />
          </span>
          <div>
            <p>{action.mode === 'request' ? '원장 확인 필요' : '중요 작업 · 한 번 더 확인'}</p>
            <h2 id="safety-dialog-title">{action.title}</h2>
          </div>
        </header>

        <p id="safety-dialog-description" className="dialog-description">
          {action.description}
        </p>

        <div className="target-summary">
          <span>처리 대상</span>
          <strong>{action.targetLabel}</strong>
        </div>

        <div className="impact-box">
          <h3>이 작업의 영향</h3>
          <ul>
            {action.impacts.map((impact) => (
              <li key={impact}>
                <Icon name="check" size={17} />
                <span>{impact}</span>
              </li>
            ))}
          </ul>
        </div>

        <label className="confirmation-field">
          <span>
            계속하려면 <strong>{action.confirmationText}</strong>을(를) 입력하세요
          </span>
          <input
            autoComplete="off"
            onChange={(event) => setTypedValue(event.target.value)}
            placeholder={action.confirmationText}
            value={typedValue}
          />
        </label>

        <label className="understanding-check">
          <input
            checked={understood}
            onChange={(event) => setUnderstood(event.target.checked)}
            type="checkbox"
          />
          <span>
            처리 대상과 위에 표시된 영향을 모두 확인했으며, 이 작업을 계속할게요.
          </span>
        </label>

        <footer>
          <button className="secondary-button" onClick={onCancel} type="button">
            취소하고 돌아가기
          </button>
          <button
            className="danger-button"
            disabled={!canConfirm}
            onClick={() => onConfirm(action)}
            type="button"
          >
            {secondsLeft > 0 ? `${secondsLeft}초 후 선택 가능` : action.actionLabel}
          </button>
        </footer>
      </section>
    </div>
  )
}
