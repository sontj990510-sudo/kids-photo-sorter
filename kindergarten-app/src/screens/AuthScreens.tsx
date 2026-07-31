import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from '../data'
import { Icon } from '../components/Icon'
import { ForestBackdrop, TreeLogo } from '../components/TreeLogo'
import type { Role } from '../types'

type Navigate = (destination: 'welcome' | 'login' | 'signup' | 'pending') => void

export function SplashScreen({
  onSkip,
}: {
  onSkip: () => void
}) {
  return (
    <main className="splash-screen">
      <ForestBackdrop />
      <button className="splash-skip" onClick={onSkip} type="button">
        건너뛰기
      </button>
      <div className="splash-brand">
        <TreeLogo animated />
        <div className="splash-copy">
          <span>마음이 자라는 따뜻한 공간</span>
          <h1>Giving Tree</h1>
          <p>KINDERGARTEN</p>
        </div>
      </div>
      <div className="splash-loader" aria-label="앱을 준비하는 중" role="status">
        <span />
        <span />
        <span />
      </div>
    </main>
  )
}

export function WelcomeScreen({
  navigate,
  onDemoLogin,
  onReplayIntro,
}: {
  navigate: Navigate
  onDemoLogin: (role: Role) => void
  onReplayIntro: () => void
}) {
  return (
    <main className="auth-shell">
      <ForestBackdrop />
      <section className="auth-card welcome-card">
        <div className="auth-brand">
          <TreeLogo compact />
          <div>
            <span>따뜻한 하루가 모이는 곳</span>
            <h1>Giving Tree</h1>
          </div>
        </div>

        <div className="welcome-message">
          <p className="eyebrow">WELCOME TO OUR FOREST</p>
          <h2>아이의 하루를<br />가까이에서 만나요</h2>
          <p>
            공지, 알림장, 식단과 우리 아이 사진까지
            <br />
            한곳에서 쉽고 안전하게 확인해요.
          </p>
        </div>

        <div className="primary-actions">
          <button className="primary-button" onClick={() => navigate('login')} type="button">
            로그인
          </button>
          <button
            className="outline-button"
            onClick={() => navigate('signup')}
            type="button"
          >
            가입 신청
          </button>
        </div>

        <aside className="prototype-notice">
          <Icon name="leaf" size={19} />
          <div>
            <strong>무료 UI 시제품</strong>
            <span>실제 아이 이름·전화번호·사진은 입력하지 마세요.</span>
          </div>
        </aside>

        <div className="demo-login">
          <div>
            <span>화면을 바로 둘러보고 싶나요?</span>
            <strong>데모 역할로 시작하기</strong>
          </div>
          <div className="demo-role-buttons">
            {(['director', 'teacher', 'parent'] as Role[]).map((role) => (
              <button key={role} onClick={() => onDemoLogin(role)} type="button">
                {ROLE_LABELS[role]}
              </button>
            ))}
          </div>
        </div>

        <button className="text-button replay-button" onClick={onReplayIntro} type="button">
          인트로 다시 보기
        </button>
      </section>
    </main>
  )
}

export function LoginScreen({
  navigate,
  onLogin,
}: {
  navigate: Navigate
  onLogin: (role: Role) => void
}) {
  const [userId, setUserId] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [demoRole, setDemoRole] = useState<Role>('parent')
  const [error, setError] = useState('')

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!userId.trim() || !password) {
      setError('아이디와 비밀번호를 모두 입력해 주세요.')
      return
    }

    setError('')
    onLogin(demoRole)
  }

  return (
    <main className="auth-shell">
      <ForestBackdrop />
      <section className="auth-card form-card">
        <button
          aria-label="이전 화면으로"
          className="round-back-button"
          onClick={() => navigate('welcome')}
          type="button"
        >
          <Icon name="back" size={23} />
        </button>

        <header className="form-heading">
          <TreeLogo compact />
          <p>다시 만나서 반가워요</p>
          <h1>Giving Tree 로그인</h1>
          <span>현재는 실제 서버와 연결되지 않은 데모 화면이에요.</span>
        </header>

        <form className="stacked-form" onSubmit={handleSubmit}>
          <label>
            <span>아이디</span>
            <input
              aria-describedby={error ? 'login-error' : undefined}
              aria-invalid={Boolean(error)}
              autoComplete="username"
              onChange={(event) => {
                setUserId(event.target.value)
                setError('')
              }}
              placeholder="테스트용 아이디"
              value={userId}
            />
          </label>

          <label>
            <span>비밀번호</span>
            <div className="password-field">
              <input
                aria-describedby={error ? 'login-error' : undefined}
                aria-invalid={Boolean(error)}
                autoComplete="current-password"
                onChange={(event) => {
                  setPassword(event.target.value)
                  setError('')
                }}
                placeholder="8자 이상"
                type={showPassword ? 'text' : 'password'}
                value={password}
              />
              <button
                aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
                onClick={() => setShowPassword((current) => !current)}
                type="button"
              >
                {showPassword ? '숨기기' : '보기'}
              </button>
            </div>
          </label>

          <fieldset className="demo-role-fieldset">
            <legend>데모에서 확인할 화면</legend>
            <div>
              {(['director', 'teacher', 'parent'] as Role[]).map((role) => (
                <label key={role} className={demoRole === role ? 'selected' : ''}>
                  <input
                    checked={demoRole === role}
                    name="demo-role"
                    onChange={() => setDemoRole(role)}
                    type="radio"
                    value={role}
                  />
                  <span>{ROLE_LABELS[role]}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {error && (
            <p className="form-error" id="login-error" role="alert">
              {error}
            </p>
          )}

          <button className="primary-button" type="submit">
            데모 로그인
          </button>
        </form>

        <div className="form-footer-copy">
          <span>아직 계정이 없나요?</span>
          <button className="text-button" onClick={() => navigate('signup')} type="button">
            가입 신청하기
          </button>
        </div>
      </section>
    </main>
  )
}

type SignupForm = {
  role: Exclude<Role, 'director'>
  userId: string
  password: string
  passwordConfirm: string
  phone: string
  koreanName: string
  englishName: string
  birthDate: string
}

const initialSignupForm: SignupForm = {
  role: 'parent',
  userId: '',
  password: '',
  passwordConfirm: '',
  phone: '',
  koreanName: '',
  englishName: '',
  birthDate: '',
}

let signupDraft: SignupForm = { ...initialSignupForm }
let signupDraftStep = 1

function getLocalDateString() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function SignupScreen({
  navigate,
}: {
  navigate: Navigate
}) {
  const [step, setStep] = useState(signupDraftStep)
  const [form, setForm] = useState(() => ({ ...signupDraft }))
  const [error, setError] = useState('')

  const maxBirthDate = useMemo(() => getLocalDateString(), [])

  const updateField = <Key extends keyof SignupForm>(
    key: Key,
    value: SignupForm[Key],
  ) => {
    setForm((current) => {
      const next = { ...current, [key]: value }
      signupDraft = next
      return next
    })
    setError('')
  }

  const goToStep = (nextStep: number) => {
    const safeStep = Math.max(1, Math.min(4, nextStep))
    signupDraftStep = safeStep
    setStep(safeStep)
    setError('')
  }

  const validateCurrentStep = () => {
    if (step === 2) {
      if (form.userId.trim().length < 4) {
        return '아이디는 4자 이상으로 입력해 주세요.'
      }
      if (form.password.length < 8) {
        return '비밀번호는 8자 이상으로 입력해 주세요.'
      }
      if (form.password !== form.passwordConfirm) {
        return '비밀번호가 서로 달라요. 다시 확인해 주세요.'
      }
    }

    if (step === 3) {
      if (form.phone.replace(/\D/g, '').length < 10) {
        return '테스트용 전화번호 형식을 확인해 주세요.'
      }

      if (
        form.role === 'parent' &&
        !form.koreanName.trim() &&
        !form.englishName.trim()
      ) {
        return '아이의 한국 이름과 영어 이름 중 하나는 입력해 주세요.'
      }

      if (form.role === 'parent' && !form.birthDate) {
        return '아이의 생년월일을 선택해 주세요.'
      }

      if (form.birthDate && form.birthDate > maxBirthDate) {
        return '미래 날짜는 생년월일로 선택할 수 없어요.'
      }
    }

    return ''
  }

  const goNext = () => {
    const nextError = validateCurrentStep()
    if (nextError) {
      setError(nextError)
      return
    }

    setError('')
    goToStep(step + 1)
  }

  const submitApplication = () => {
    signupDraft = form
    signupDraftStep = 4
    navigate('pending')
  }

  return (
    <main className="auth-shell signup-shell">
      <ForestBackdrop />
      <section className="auth-card signup-card">
        <header className="signup-header">
          <button
            aria-label={step === 1 ? '이전 화면으로' : '이전 단계로'}
            className="round-back-button"
            onClick={() =>
              step === 1 ? navigate('welcome') : goToStep(step - 1)
            }
            type="button"
          >
            <Icon name="back" size={23} />
          </button>
          <div>
            <p>가입 신청</p>
            <h1>
              {step === 1 && '어떤 분이신가요?'}
              {step === 2 && '로그인 정보를 정해요'}
              {step === 3 && '신청 정보를 확인해요'}
              {step === 4 && '마지막으로 검토해요'}
            </h1>
          </div>
          <span className="step-count">{step} / 4</span>
        </header>

        <div
          aria-label={`가입 신청 ${step}단계`}
          aria-valuemax={4}
          aria-valuemin={1}
          aria-valuenow={step}
          className="step-progress"
          role="progressbar"
        >
          {[1, 2, 3, 4].map((item) => (
            <span className={item <= step ? 'active' : ''} key={item} />
          ))}
        </div>

        <aside className="privacy-demo-banner">
          <Icon name="lock" size={18} />
          <span>데모입니다. 실제 개인정보 대신 가상 정보를 사용해 주세요.</span>
        </aside>

        {step === 1 && (
          <div className="role-choice-list">
            {(['parent', 'teacher'] as const).map((role) => (
              <button
                aria-pressed={form.role === role}
                className={form.role === role ? 'selected' : ''}
                key={role}
                onClick={() => updateField('role', role)}
                type="button"
              >
                <span className="role-choice-icon">
                  <Icon name={role === 'parent' ? 'profile' : 'leaf'} size={28} />
                </span>
                <span>
                  <strong>{ROLE_LABELS[role]}</strong>
                  <small>{ROLE_DESCRIPTIONS[role]}</small>
                </span>
                <i>
                  <Icon name="check" size={20} />
                </i>
              </button>
            ))}
            <div className="director-signup-note">
              <Icon name="shield" size={21} />
              <span>
                <strong>원장 계정은 공개 가입할 수 없어요.</strong>
                유치원 개설 단계에서 별도로 안전하게 생성합니다.
              </span>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="stacked-form">
            <label>
              <span>아이디</span>
              <input
                aria-describedby={error ? 'signup-error' : undefined}
                aria-invalid={Boolean(error)}
                autoComplete="username"
                onChange={(event) => updateField('userId', event.target.value)}
                placeholder="4자 이상"
                value={form.userId}
              />
            </label>
            <label>
              <span>비밀번호</span>
              <input
                aria-describedby={error ? 'signup-error' : undefined}
                aria-invalid={Boolean(error)}
                autoComplete="new-password"
                onChange={(event) => updateField('password', event.target.value)}
                placeholder="8자 이상"
                type="password"
                value={form.password}
              />
            </label>
            <label>
              <span>비밀번호 다시 입력</span>
              <input
                aria-describedby={error ? 'signup-error' : undefined}
                aria-invalid={Boolean(error)}
                autoComplete="new-password"
                onChange={(event) =>
                  updateField('passwordConfirm', event.target.value)
                }
                placeholder="같은 비밀번호를 입력해 주세요"
                type="password"
                value={form.passwordConfirm}
              />
            </label>
          </div>
        )}

        {step === 3 && (
          <div className="stacked-form">
            <label>
              <span>전화번호</span>
              <input
                aria-describedby={error ? 'signup-error' : undefined}
                aria-invalid={Boolean(error)}
                autoComplete="tel"
                inputMode="tel"
                onChange={(event) => updateField('phone', event.target.value)}
                placeholder="예: 010-0000-0000"
                value={form.phone}
              />
              <small className="field-helper">
                문자 인증은 비용이 발생할 수 있어 현재 무료 시제품에서는 연결하지
                않았어요.
              </small>
            </label>

            {form.role === 'parent' ? (
              <>
                <div className="two-field-grid">
                  <label>
                    <span>아이 한국 이름</span>
                    <input
                      aria-describedby={error ? 'signup-error' : undefined}
                      aria-invalid={Boolean(error)}
                      onChange={(event) =>
                        updateField('koreanName', event.target.value)
                      }
                      placeholder="둘 중 하나만 입력 가능"
                      value={form.koreanName}
                    />
                  </label>
                  <label>
                    <span>아이 영어 이름</span>
                    <input
                      aria-describedby={error ? 'signup-error' : undefined}
                      aria-invalid={Boolean(error)}
                      onChange={(event) =>
                        updateField('englishName', event.target.value)
                      }
                      placeholder="둘 중 하나만 입력 가능"
                      value={form.englishName}
                    />
                  </label>
                </div>
                <label>
                  <span>아이 생년월일</span>
                  <input
                    aria-describedby={error ? 'signup-error' : undefined}
                    aria-invalid={Boolean(error)}
                    max={maxBirthDate}
                    onChange={(event) => updateField('birthDate', event.target.value)}
                    type="date"
                    value={form.birthDate}
                  />
                </label>
                <p className="matching-explanation">
                  원장이 유치원 원아 명단과 확인한 뒤 보호자와 아이를 연결합니다.
                  이름만으로 자동 연결하지 않아요.
                </p>
              </>
            ) : (
              <div className="matching-explanation teacher-explanation">
                가입 승인 후 원장이 담당 반과 공지·식단 작성 권한을 지정합니다.
                교사가 스스로 권한을 늘릴 수는 없어요.
              </div>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="review-card">
            <div>
              <span>신청 역할</span>
              <strong>{ROLE_LABELS[form.role]}</strong>
            </div>
            <div>
              <span>아이디</span>
              <strong>{form.userId || '입력 전'}</strong>
            </div>
            <div>
              <span>전화번호</span>
              <strong>{form.phone || '입력 전'}</strong>
            </div>
            {form.role === 'parent' && (
              <>
                <div>
                  <span>아이 이름</span>
                  <strong>
                    {[form.koreanName, form.englishName].filter(Boolean).join(' · ') ||
                      '입력 전'}
                  </strong>
                </div>
                <div>
                  <span>생년월일</span>
                  <strong>{form.birthDate || '입력 전'}</strong>
                </div>
              </>
            )}
            <p>
              실제 운영에서는 전화 인증과 원장 확인이 끝난 뒤에만 앱을 사용할 수
              있습니다.
            </p>
          </div>
        )}

        {error && (
          <p className="form-error" id="signup-error" role="alert">
            {error}
          </p>
        )}

        <footer className="signup-footer">
          {step < 4 ? (
            <button className="primary-button" onClick={goNext} type="button">
              다음 단계
              <Icon name="chevron" size={20} />
            </button>
          ) : (
            <button
              className="primary-button"
              onClick={submitApplication}
              type="button"
            >
              가입 신청 보내기
            </button>
          )}
        </footer>
      </section>
    </main>
  )
}

export function PendingScreen({
  navigate,
}: {
  navigate: Navigate
}) {
  return (
    <main className="auth-shell">
      <ForestBackdrop />
      <section className="auth-card pending-card">
        <div className="pending-illustration">
          <TreeLogo compact />
          <span className="pending-check">
            <Icon name="check" size={26} />
          </span>
        </div>
        <p className="eyebrow">APPLICATION RECEIVED</p>
        <h1>가입 신청을 받았어요</h1>
        <p>
          원장이 신청 정보와 원아 명단을 확인한 뒤 승인합니다.
          <br />
          승인 전에는 유치원 자료를 볼 수 없어요.
        </p>

        <div className="pending-steps">
          <div className="done">
            <span>
              <Icon name="check" size={17} />
            </span>
            <p>
              <strong>가입 신청 완료</strong>
              <small>데모 신청이 안전하게 접수되었어요</small>
            </p>
          </div>
          <div className="current">
            <span>2</span>
            <p>
              <strong>원장 확인 중</strong>
              <small>실제 운영에서는 앱에서 상태를 확인해요</small>
            </p>
          </div>
          <div>
            <span>3</span>
            <p>
              <strong>승인 후 이용 시작</strong>
              <small>담당 반과 아이 연결이 확인된 뒤 열려요</small>
            </p>
          </div>
        </div>

        <button
          className="primary-button"
          onClick={() => navigate('welcome')}
          type="button"
        >
          처음 화면으로
        </button>
        <button className="text-button" onClick={() => navigate('signup')} type="button">
          신청 내용 수정하기
        </button>
      </section>
    </main>
  )
}
