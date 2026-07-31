import { useEffect, useMemo, useRef, useState } from 'react'
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
  const severity = action.severity ?? 'critical'
  const [secondsLeft, setSecondsLeft] = useState(
    severity === 'critical' ? 3 : 1,
  )
  const dialogRef = useRef<HTMLElement>(null)
  const cancelButtonRef = useRef<HTMLButtonElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

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
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null

    const appChildren = Array.from(
      document.querySelectorAll<HTMLElement>(
        '.kindergarten-app > :not(.dialog-overlay):not(.toast)',
      ),
    )
    const previousOverflow = document.body.style.overflow

    appChildren.forEach((element) => {
      element.inert = true
      element.setAttribute('aria-hidden', 'true')
    })
    document.body.style.overflow = 'hidden'

    const focusFrame = window.requestAnimationFrame(() => {
      cancelButtonRef.current?.focus()
    })

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCancel()
        return
      }

      if (event.key !== 'Tab' || !dialogRef.current) {
        return
      }

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])',
        ),
      )
      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (!first || !last) {
        event.preventDefault()
        return
      }

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.cancelAnimationFrame(focusFrame)
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      appChildren.forEach((element) => {
        element.inert = false
        element.removeAttribute('aria-hidden')
      })
      previousFocusRef.current?.focus()
    }
  }, [onCancel])

  return (
    <div
      className={`dialog-overlay dialog-${severity}`}
      role="presentation"
    >
      <section
        aria-describedby="safety-dialog-description"
        aria-labelledby="safety-dialog-title"
        aria-modal="true"
        className="safety-dialog"
        ref={dialogRef}
        role="dialog"
      >
        <header>
          <span className="warning-icon">
            <Icon name="warning" size={25} />
          </span>
          <div>
            <p>
              {severity === 'critical'
                ? '중요 작업 · 한 번 더 확인'
                : action.mode === 'request'
                  ? '원장 확인 요청'
                  : '변경 전 검토'}
            </p>
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

        <p className="dialog-readiness" aria-live="polite">
          {secondsLeft > 0
            ? `${secondsLeft}초 후 확인할 수 있습니다.`
            : typedValue.trim() !== action.confirmationText
              ? `확인 문구 “${action.confirmationText}”을 정확히 입력해 주세요.`
              : !understood
                ? '영향 확인 항목에 체크해 주세요.'
                : '모든 확인 조건을 충족했습니다.'}
        </p>

        <footer>
          <button
            className="secondary-button"
            onClick={onCancel}
            ref={cancelButtonRef}
            type="button"
          >
            취소하고 돌아가기
          </button>
          <button
            className={severity === 'critical' ? 'danger-button' : 'primary-button'}
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
