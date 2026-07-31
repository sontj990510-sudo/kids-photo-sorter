import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from '../data'
import { Icon } from '../components/Icon'
import { ForestBackdrop, TreeLogo } from '../components/TreeLogo'
import {
  DEMO_PHONE_CODE,
  GUARDIAN_RELATIONSHIP_OPTIONS,
  LEGAL_AUTHORITY_OPTIONS,
  formatUsPhoneInput,
  getLegalAuthorityLabel,
  getRelationshipLabel,
  isStructurallyValidUsPhone,
  toUsE164,
} from '../signupModel'
import type {
  GuardianRelationship,
  LegalAuthorityClaim,
} from '../signupModel'
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
  roleSelected: boolean
  userId: string
  password: string
  passwordConfirm: string
  applicantName: string
  phone: string
  smsVerificationConsent: boolean
  phoneDemoChecked: boolean
  koreanName: string
  englishName: string
  birthDate: string
  relationship: GuardianRelationship
  relationshipOther: string
  legalAuthorityClaim: LegalAuthorityClaim
}

const initialSignupForm: SignupForm = {
  role: 'parent',
  roleSelected: false,
  userId: '',
  password: '',
  passwordConfirm: '',
  applicantName: '',
  phone: '',
  smsVerificationConsent: false,
  phoneDemoChecked: false,
  koreanName: '',
  englishName: '',
  birthDate: '',
  relationship: 'father',
  relationshipOther: '',
  legalAuthorityClaim: 'unsure',
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
  const [phoneCode, setPhoneCode] = useState('')
  const [phoneCodeSent, setPhoneCodeSent] = useState(false)
  const [phoneCodeError, setPhoneCodeError] = useState('')

  const maxBirthDate = useMemo(() => getLocalDateString(), [])

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const heading = document.querySelector<HTMLElement>('.signup-header h1')
      heading?.focus({ preventScroll: true })
    })

    return () => window.cancelAnimationFrame(frame)
  }, [step])

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
    const safeStep = Math.max(1, Math.min(5, nextStep))
    signupDraftStep = safeStep
    setStep(safeStep)
    setError('')
  }

  const updatePhone = (value: string) => {
    const nextPhone = formatUsPhoneInput(value)

    setForm((current) => {
      const next = {
        ...current,
        phone: nextPhone,
        phoneDemoChecked: false,
      }
      signupDraft = next
      return next
    })
    setPhoneCode('')
    setPhoneCodeSent(false)
    setPhoneCodeError('')
    setError('')
  }

  const selectRole = (role: SignupForm['role']) => {
    setForm((current) => {
      const next = { ...current, role, roleSelected: true }
      signupDraft = next
      return next
    })
    setError('')
  }

  const selectRelationship = (relationship: GuardianRelationship) => {
    setForm((current) => {
      const next = {
        ...current,
        relationship,
        relationshipOther:
          relationship === 'other' ? current.relationshipOther : '',
      }
      signupDraft = next
      return next
    })
    setError('')
  }

  const startPhoneDemo = () => {
    if (!isStructurallyValidUsPhone(form.phone)) {
      setError('미국 전화번호 10자리를 확인해 주세요.')
      return
    }

    if (!form.smsVerificationConsent) {
      setError('가입 인증 문자 안내를 확인하고 동의해 주세요.')
      return
    }

    setError('')
    setPhoneCode('')
    setPhoneCodeError('')
    setPhoneCodeSent(true)
    updateField('phoneDemoChecked', false)
  }

  const checkPhoneDemoCode = () => {
    if (phoneCode !== DEMO_PHONE_CODE) {
      setPhoneCodeError('화면에 표시된 6자리 데모 번호를 입력해 주세요.')
      updateField('phoneDemoChecked', false)
      return
    }

    setPhoneCodeError('')
    updateField('phoneDemoChecked', true)
  }

  const validateStep = (stepToValidate: number) => {
    if (stepToValidate === 1 && !form.roleSelected) {
      return '학부모 또는 교사를 선택해 주세요.'
    }

    if (stepToValidate === 2) {
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

    if (stepToValidate === 3) {
      if (form.applicantName.trim().length < 2) {
        return '신청자 이름을 2자 이상 입력해 주세요.'
      }

      if (!isStructurallyValidUsPhone(form.phone)) {
        return '미국 전화번호 10자리를 확인해 주세요.'
      }

      if (!form.smsVerificationConsent) {
        return '가입 인증 문자 안내를 확인하고 동의해 주세요.'
      }

      if (!form.phoneDemoChecked) {
        return '무료 시제품의 전화번호 확인 화면을 먼저 완료해 주세요.'
      }
    }

    if (stepToValidate === 4) {
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

      if (
        form.role === 'parent' &&
        form.relationship === 'other' &&
        !form.relationshipOther.trim()
      ) {
        return '아이와의 관계를 직접 입력해 주세요.'
      }

      if (
        form.role === 'parent' &&
        form.relationshipOther.trim().length > 50
      ) {
        return '기타 관계는 50자 이내로 입력해 주세요.'
      }
    }

    return ''
  }

  const goNext = () => {
    const nextError = validateStep(step)
    if (nextError) {
      setError(nextError)
      return
    }

    setError('')
    goToStep(step + 1)
  }

  const submitApplication = () => {
    for (const stepToValidate of [1, 2, 3, 4]) {
      const nextError = validateStep(stepToValidate)
      if (nextError) {
        goToStep(stepToValidate)
        setError(nextError)
        return
      }
    }

    signupDraft = {
      ...form,
      password: '',
      passwordConfirm: '',
      phoneDemoChecked: false,
    }
    signupDraftStep = 1
    navigate('pending')
  }

  return (
    <main className="auth-shell signup-shell">
      <ForestBackdrop />
      <form
        className="auth-card signup-card"
        onSubmit={(event) => {
          event.preventDefault()
          if (step < 5) {
            goNext()
          } else {
            submitApplication()
          }
        }}
      >
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
            <h1 tabIndex={-1}>
              {step === 1 && '어떤 분이신가요?'}
              {step === 2 && '로그인 정보를 정해요'}
              {step === 3 && '연락처를 확인해요'}
              {step === 4 &&
                (form.role === 'parent'
                  ? '아이와의 관계를 알려주세요'
                  : '교사 신청을 확인해요')}
              {step === 5 && '마지막으로 검토해요'}
            </h1>
          </div>
          <span className="step-count">{step} / 5</span>
        </header>

        <div
          aria-label={`가입 신청 ${step}단계`}
          aria-valuemax={5}
          aria-valuemin={1}
          aria-valuenow={step}
          aria-valuetext={`${step} / 5 단계`}
          className="step-progress"
          role="progressbar"
        >
          {[1, 2, 3, 4, 5].map((item) => (
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
                aria-pressed={form.roleSelected && form.role === role}
                className={
                  form.roleSelected && form.role === role ? 'selected' : ''
                }
                key={role}
                onClick={() => selectRole(role)}
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
              <span>신청자 이름</span>
              <input
                aria-describedby={error ? 'signup-error' : undefined}
                aria-invalid={Boolean(error)}
                autoComplete="name"
                onChange={(event) =>
                  updateField('applicantName', event.target.value)
                }
                placeholder="예: Jiwoo Park"
                value={form.applicantName}
              />
            </label>

            <div className="phone-verification-block">
              <label>
                <span>미국 휴대전화 번호</span>
                <div className="phone-input-row">
                  <span aria-hidden="true">+1</span>
                  <input
                    aria-describedby="phone-format-help"
                    aria-invalid={
                      Boolean(form.phone) &&
                      !isStructurallyValidUsPhone(form.phone)
                    }
                    autoComplete="tel-national"
                    inputMode="tel"
                    onChange={(event) => updatePhone(event.target.value)}
                    placeholder="(714) 555-0123"
                    value={form.phone}
                  />
                </div>
                <small className="field-helper" id="phone-format-help">
                  미국·캐나다 번호는 +1 국제 형식으로 저장할 예정이에요.
                </small>
              </label>

              <label className="consent-check">
                <input
                  checked={form.smsVerificationConsent}
                  onChange={(event) => {
                    updateField(
                      'smsVerificationConsent',
                      event.target.checked,
                    )
                    if (!event.target.checked) {
                      updateField('phoneDemoChecked', false)
                      setPhoneCodeSent(false)
                      setPhoneCode('')
                    }
                  }}
                  type="checkbox"
                />
                <span>
                  가입 시 전화번호 확인을 위한 인증문자 수신 안내를
                  확인했습니다. 실제 운영 시 통신사 문자 요금이 발생할 수
                  있습니다.
                </span>
              </label>

              <button
                className="secondary-button phone-demo-button"
                disabled={
                  !isStructurallyValidUsPhone(form.phone) ||
                  !form.smsVerificationConsent
                }
                onClick={startPhoneDemo}
                type="button"
              >
                {phoneCodeSent ? '데모 번호 다시 보기' : '인증 화면 체험하기'}
              </button>

              {phoneCodeSent && (
                <div className="demo-code-panel">
                  <p>
                    <strong>실제 문자는 발송되지 않았어요.</strong>
                    화면 테스트용 번호 <b>{DEMO_PHONE_CODE}</b>를 아래에
                    입력해 주세요.
                  </p>
                  <div>
                    <input
                      aria-label="6자리 데모 인증번호"
                      autoComplete="one-time-code"
                      inputMode="numeric"
                      maxLength={6}
                      onChange={(event) => {
                        setPhoneCode(
                          event.target.value.replace(/\D/g, '').slice(0, 6),
                        )
                        setPhoneCodeError('')
                        updateField('phoneDemoChecked', false)
                      }}
                      placeholder="6자리"
                      value={phoneCode}
                    />
                    <button
                      className="outline-button"
                      onClick={checkPhoneDemoCode}
                      type="button"
                    >
                      확인
                    </button>
                  </div>
                  {phoneCodeError && (
                    <span className="phone-code-error" role="alert">
                      {phoneCodeError}
                    </span>
                  )}
                </div>
              )}

              <p
                aria-live="polite"
                className={`phone-demo-status ${
                  form.phoneDemoChecked ? 'checked' : ''
                }`}
                role="status"
              >
                <Icon
                  name={form.phoneDemoChecked ? 'check' : 'lock'}
                  size={18}
                />
                {form.phoneDemoChecked
                  ? '데모 절차 확인 완료 · 실제 전화번호 인증은 아닙니다.'
                  : '실제 SMS 인증은 유료 서비스 연결 전까지 비활성 상태입니다.'}
              </p>
            </div>
          </div>
        )}

        {step === 4 && (
          <>
            {form.role === 'parent' ? (
              <div className="stacked-form">
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
                    onInput={(event) =>
                      updateField('birthDate', event.currentTarget.value)
                    }
                    type="date"
                    value={form.birthDate}
                  />
                </label>

                <fieldset className="choice-fieldset relationship-fieldset">
                  <legend>아이와의 관계</legend>
                  <div className="relationship-options">
                    {GUARDIAN_RELATIONSHIP_OPTIONS.map((option) => (
                      <label
                        className={
                          form.relationship === option.value ? 'selected' : ''
                        }
                        key={option.value}
                      >
                        <input
                          checked={form.relationship === option.value}
                          name="guardian-relationship"
                          onChange={() => selectRelationship(option.value)}
                          type="radio"
                          value={option.value}
                        />
                        <span>{option.label}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                {form.relationship === 'other' && (
                  <label>
                    <span>기타 관계 직접 입력</span>
                    <input
                      aria-describedby={error ? 'signup-error' : undefined}
                      aria-invalid={Boolean(error)}
                      maxLength={50}
                      onChange={(event) =>
                        updateField('relationshipOther', event.target.value)
                      }
                      placeholder="예: 이모, 삼촌, 위탁 보호자"
                      value={form.relationshipOther}
                    />
                    <small className="field-helper">
                      50자 이내로 입력해 주세요.
                    </small>
                  </label>
                )}

                <fieldset className="choice-fieldset authority-fieldset">
                  <legend>
                    아이의 법적 부모 또는 법적 보호자입니까?
                  </legend>
                  <div>
                    {LEGAL_AUTHORITY_OPTIONS.map((option) => (
                      <label
                        className={
                          form.legalAuthorityClaim === option.value
                            ? 'selected'
                            : ''
                        }
                        key={option.value}
                      >
                        <input
                          checked={
                            form.legalAuthorityClaim === option.value
                          }
                          name="legal-authority"
                          onChange={() =>
                            updateField(
                              'legalAuthorityClaim',
                              option.value,
                            )
                          }
                          type="radio"
                          value={option.value}
                        />
                        <span>{option.label}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <p className="matching-explanation">
                  관계 선택과 전화번호 확인만으로 아이 자료가 열리지 않아요.
                  원장이 유치원 원아 명단과 보호자 정보를 별도로 확인한 뒤
                  아이를 연결합니다.
                </p>
              </div>
            ) : (
              <div className="teacher-application-card">
                <Icon name="shield" size={25} />
                <div>
                  <strong>교직원 명단 확인 후 승인됩니다</strong>
                  <p>
                    원장이 신청자 이름과 재직 정보를 확인한 뒤 담당 반과
                    필요한 권한만 지정합니다. 교사가 스스로 권한을 늘릴 수는
                    없어요.
                  </p>
                </div>
              </div>
            )}
          </>
        )}

        {step === 5 && (
          <div className="review-card">
            <div>
              <span>신청 역할</span>
              <strong>{ROLE_LABELS[form.role]}</strong>
            </div>
            <div>
              <span>신청자 이름</span>
              <strong>{form.applicantName || '입력 전'}</strong>
            </div>
            <div>
              <span>아이디</span>
              <strong>{form.userId || '입력 전'}</strong>
            </div>
            <div>
              <span>전화번호</span>
              <strong>{form.phone ? `+1 ${form.phone}` : '입력 전'}</strong>
            </div>
            <div>
              <span>전화 확인</span>
              <strong>
                {form.phoneDemoChecked
                  ? '데모 절차 확인 · 실제 인증 아님'
                  : '확인 전'}
              </strong>
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
                <div>
                  <span>아이와의 관계</span>
                  <strong>
                    {getRelationshipLabel(
                      form.relationship,
                      form.relationshipOther,
                    )}
                  </strong>
                </div>
                <div>
                  <span>법적 보호자 응답</span>
                  <strong>
                    {getLegalAuthorityLabel(form.legalAuthorityClaim)}
                    {' · 원장 확인 필요'}
                  </strong>
                </div>
              </>
            )}
            <p>
              실제 운영에서는 {toUsE164(form.phone) ?? '전화번호'}에 대한
              SMS 인증과 원장 확인이 각각 끝난 뒤에만 앱을 사용할 수
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
          {step < 5 ? (
            <button className="primary-button" type="submit">
              다음 단계
              <Icon name="chevron" size={20} />
            </button>
          ) : (
            <button className="primary-button" type="submit">
              가입 신청 보내기
            </button>
          )}
        </footer>
      </form>
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
