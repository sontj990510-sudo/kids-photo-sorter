import { useState } from 'react'
import { MENU_TITLES, ROLE_LABELS } from '../data'
import { Icon } from '../components/Icon'
import type { MenuKey, Role, SafetyAction } from '../types'

type MenuScreenProps = {
  menu: MenuKey
  role: Role
  onBack: () => void
  onOpenMenu: (menu: MenuKey) => void
  onSafetyAction: (action: SafetyAction) => void
  onToast: (message: string) => void
  onLogout: () => void
  onReplayIntro: () => void
}

function PageHeader({
  title,
  eyebrow,
  onBack,
  action,
}: {
  title: string
  eyebrow: string
  onBack: () => void
  action?: React.ReactNode
}) {
  return (
    <header className="page-header">
      <button aria-label="홈으로 돌아가기" onClick={onBack} type="button">
        <Icon name="back" size={23} />
      </button>
      <div>
        <span>{eyebrow}</span>
        <h1>{title}</h1>
      </div>
      <div className="page-header-action">{action}</div>
    </header>
  )
}

function GlobalNotices({
  role,
  onToast,
}: {
  role: Role
  onToast: (message: string) => void
}) {
  return (
    <div className="content-stack">
      {(role === 'director' || role === 'teacher') && (
        <button
          className="compose-card"
          onClick={() =>
            onToast('무료 시제품에서는 공지 작성 화면만 확인할 수 있어요.')
          }
          type="button"
        >
          <span>
            <Icon name="notice" size={23} />
          </span>
          <div>
            <strong>새 전체 공지 작성</strong>
            <small>
              게시 전 수신 대상과 알림 여부를 한 번 더 확인합니다.
            </small>
          </div>
          <Icon name="chevron" size={21} />
        </button>
      )}

      <section className="paper-list">
        <article className="notice-paper important">
          <div className="paper-topline">
            <span>중요 공지</span>
            <time>오늘 09:20</time>
          </div>
          <h2>8월 여름 물놀이 준비 안내</h2>
          <p>
            다음 주 금요일에는 원내 물놀이 활동이 예정되어 있습니다. 수영복과
            수건을 이름이 보이도록 준비해 주세요.
          </p>
          <footer>
            <span>첨부파일 1개</span>
            <strong>읽었어요 38 / 42</strong>
          </footer>
        </article>
        <article className="notice-paper">
          <div className="paper-topline">
            <span>전체 안내</span>
            <time>어제 16:10</time>
          </div>
          <h2>여름방학 기간 운영시간 안내</h2>
          <p>
            방학 중 통합 보육 기간과 등·하원 시간을 확인해 주세요. 자세한
            일정은 첨부된 표에서 볼 수 있습니다.
          </p>
          <footer>
            <span>첨부파일 1개</span>
            <strong>읽었어요 40 / 42</strong>
          </footer>
        </article>
      </section>
    </div>
  )
}

function ClassNote({ role }: { role: Role }) {
  return (
    <div className="content-stack">
      <section className="class-day-card">
        <div>
          <span>판다반 · 오늘</span>
          <strong>7월 30일 목요일</strong>
        </div>
        <span className="weather-sticker">☀️ 27°C</span>
      </section>

      {role === 'teacher' && (
        <button className="compose-card" type="button">
          <span>
            <Icon name="note" size={23} />
          </span>
          <div>
            <strong>오늘 알림장 작성하기</strong>
            <small>임시저장 후 게시 전에 반과 알림을 다시 확인해요.</small>
          </div>
          <Icon name="chevron" size={21} />
        </button>
      )}

      <article className="daily-note">
        <header>
          <div className="teacher-avatar">봄</div>
          <div>
            <strong>이새봄 선생님</strong>
            <span>오늘 15:42</span>
          </div>
          <i>NEW</i>
        </header>
        <h2>숲속 친구들과 여름 열매를 관찰했어요</h2>
        <p>
          오늘 판다반 친구들은 마당에서 방울토마토와 블루베리를 관찰했어요.
          열매의 색과 향을 이야기하고, 작은 그림 카드도 만들었습니다.
        </p>
        <div className="note-photo-grid" aria-label="알림장 사진 자리">
          <span className="mock-photo photo-green" />
          <span className="mock-photo photo-yellow" />
          <span className="mock-photo photo-blue" />
        </div>
        <footer>
          <span>읽었어요 11 / 12</span>
          <button type="button">댓글 3개</button>
        </footer>
      </article>
    </div>
  )
}

function MealMenu({ role }: { role: Role }) {
  const weekdays = [
    { day: '월', date: '27', meal: '소고기 미역국', snack: '바나나·우유' },
    { day: '화', date: '28', meal: '닭고기 카레라이스', snack: '찐옥수수' },
    { day: '수', date: '29', meal: '두부 된장국', snack: '제철 과일' },
    { day: '목', date: '30', meal: '연어 야채볶음밥', snack: '요거트', today: true },
    { day: '금', date: '31', meal: '잔치국수·김밥', snack: '단호박죽' },
  ]

  return (
    <div className="content-stack">
      <section className="month-selector">
        <button aria-label="이전 달" type="button">
          <Icon name="back" size={19} />
        </button>
        <div>
          <span>2026년</span>
          <strong>7월 식단</strong>
        </div>
        <button aria-label="다음 달" type="button">
          <Icon name="chevron" size={19} />
        </button>
      </section>

      {(role === 'director' || role === 'teacher') && (
        <aside className="permission-note">
          <Icon name="shield" size={20} />
          <span>
            <strong>
              {role === 'director' ? '원장 작성 권한' : '위임된 식단 작성 권한'}
            </strong>
            게시 전 적용 월과 알림 발송 여부를 확인합니다.
          </span>
        </aside>
      )}

      <section className="meal-week">
        {weekdays.map((item) => (
          <article className={item.today ? 'today' : ''} key={item.day}>
            <div className="meal-date">
              <span>{item.day}</span>
              <strong>{item.date}</strong>
            </div>
            <div>
              <span>점심</span>
              <strong>{item.meal}</strong>
              <small>오후간식 · {item.snack}</small>
            </div>
            {item.today && <i>오늘</i>}
          </article>
        ))}
      </section>

      <p className="allergy-note">
        알레르기 유발 식재료는 실제 운영 단계에서 원아별 정보와 연결해 별도로
        표시합니다.
      </p>
    </div>
  )
}

function NotificationSettings({ onToast }: { onToast: (message: string) => void }) {
  const [settings, setSettings] = useState({
    global: true,
    classNote: true,
    album: true,
    meal: false,
    quiet: true,
  })

  const toggle = (key: keyof typeof settings) => {
    setSettings((current) => ({ ...current, [key]: !current[key] }))
    onToast('알림 설정을 바꿨어요. 데모 종료 시 원래대로 돌아갑니다.')
  }

  const rows = [
    {
      key: 'global' as const,
      title: '전체 공지사항',
      description: '중요 공지와 원 전체 안내',
      icon: 'notice' as const,
    },
    {
      key: 'classNote' as const,
      title: '우리 반 알림장',
      description: '담임 선생님의 새로운 알림장',
      icon: 'note' as const,
    },
    {
      key: 'album' as const,
      title: '우리 아이 사진첩',
      description: '검토를 마친 새 사진',
      icon: 'photo' as const,
    },
    {
      key: 'meal' as const,
      title: '식단표 변경',
      description: '식단이 수정되었을 때만',
      icon: 'meal' as const,
    },
  ]

  return (
    <div className="content-stack">
      <aside className="privacy-reminder compact">
        <span>
          <Icon name="lock" size={20} />
        </span>
        <div>
          <strong>잠금 화면에는 아이 정보가 보이지 않아요</strong>
          <p>“새 소식이 등록되었습니다”처럼 최소한의 내용만 표시합니다.</p>
        </div>
      </aside>

      <section className="settings-list">
        {rows.map((row) => (
          <div className="setting-row" key={row.key}>
            <span className="setting-icon">
              <Icon name={row.icon} size={22} />
            </span>
            <div>
              <strong>{row.title}</strong>
              <small>{row.description}</small>
            </div>
            <button
              aria-label={`${row.title} 알림 ${settings[row.key] ? '끄기' : '켜기'}`}
              aria-pressed={settings[row.key]}
              className={`toggle ${settings[row.key] ? 'on' : ''}`}
              onClick={() => toggle(row.key)}
              type="button"
            >
              <span />
            </button>
          </div>
        ))}
      </section>

      <section className="quiet-hours">
        <div>
          <span>
            <Icon name="bell" size={21} />
          </span>
          <p>
            <strong>야간 알림 쉬기</strong>
            <small>오후 9:00 – 오전 7:00</small>
          </p>
        </div>
        <button
          aria-label={`야간 알림 쉬기 ${settings.quiet ? '끄기' : '켜기'}`}
          aria-pressed={settings.quiet}
          className={`toggle ${settings.quiet ? 'on' : ''}`}
          onClick={() => toggle('quiet')}
          type="button"
        >
          <span />
        </button>
      </section>

      <p className="free-feature-note">
        현재는 앱 안의 설정 화면만 구현했습니다. 실제 휴대폰 푸시 발송은 서버
        단계에서 비용과 무료 한도를 안내한 뒤 연결합니다.
      </p>
    </div>
  )
}

function Approvals({
  onSafetyAction,
}: {
  onSafetyAction: (action: SafetyAction) => void
}) {
  const applicants = [
    { name: '박지우 보호자', detail: '김하린 · 판다반 신청', time: '10분 전' },
    { name: '최윤서 교사', detail: '다람쥐반 교사 신청', time: '1시간 전' },
    { name: '정서준 보호자', detail: 'Leo · 토끼반 신청', time: '어제' },
  ]

  return (
    <div className="content-stack">
      <aside className="permission-note">
        <Icon name="shield" size={20} />
        <span>
          <strong>이름만으로 아이를 자동 연결하지 않아요</strong>
          원아 명단·생년월일 일부·보호자 관계를 확인한 뒤 승인합니다.
        </span>
      </aside>

      <section className="approval-list">
        {applicants.map((applicant, index) => (
          <article key={applicant.name}>
            <div className="applicant-avatar">{applicant.name.slice(0, 1)}</div>
            <div>
              <span>{applicant.time}</span>
              <strong>{applicant.name}</strong>
              <small>{applicant.detail}</small>
            </div>
            <button
              onClick={() =>
                onSafetyAction({
                  title: '가입 신청을 승인할까요?',
                  description:
                    '담당 반과 연결 대상을 확인한 뒤에만 접근 권한이 열립니다.',
                  actionLabel: '확인 후 승인',
                  targetLabel: applicant.detail,
                  confirmationText: index === 1 ? '최윤서' : '확인',
                  impacts: [
                    '승인 전에는 어떤 유치원 자료도 볼 수 없습니다.',
                    '승인 후에도 지정된 반과 연결된 아이만 볼 수 있습니다.',
                    '승인·거절·반 배정 내용은 관리 기록에 남습니다.',
                  ],
                  mode: 'schedule',
                })
              }
              type="button"
            >
              검토
            </button>
          </article>
        ))}
      </section>
    </div>
  )
}

function ChildLifecycle({
  role,
  onSafetyAction,
  onToast,
}: {
  role: Role
  onSafetyAction: (action: SafetyAction) => void
  onToast: (message: string) => void
}) {
  const isDirector = role === 'director'

  const startLifecycleAction = () => {
    onSafetyAction({
      title: isDirector
        ? '하린이의 재원 종료를 예약할까요?'
        : '원장에게 재원 종료 처리를 요청할까요?',
      description: isDirector
        ? '졸업·퇴원은 보호자 계정 삭제와 분리됩니다. 먼저 새 자료 접근을 멈추고 복구 가능한 보관 단계로 이동합니다.'
        : '교사는 영구 삭제할 수 없습니다. 사유와 예정일을 원장에게 보내고, 원장이 확인해야 처리됩니다.',
      actionLabel: isDirector ? '재원 종료 예약' : '원장에게 요청 보내기',
      targetLabel: '김하린 · 판다반 · 원아번호 GT-1024',
      confirmationText: '김하린',
      impacts: [
        '예정일부터 새 알림장·사진 연결이 중지됩니다.',
        '보호자는 정해진 기간 동안 기존 자료를 읽기 전용으로 확인합니다.',
        '30일 동안 원장이 취소하거나 복원할 수 있습니다.',
        '형제자매가 있다면 보호자 계정은 계속 유지됩니다.',
      ],
      mode: isDirector ? 'schedule' : 'request',
    })
  }

  return (
    <div className="content-stack">
      <section className="class-summary-card">
        <div className="class-animal">🐼</div>
        <div>
          <span>담임 · 이새봄 선생님</span>
          <strong>판다반</strong>
          <small>재원 12명 · 보호자 연결 18명</small>
        </div>
        <button type="button">반 보기</button>
      </section>

      <section className="child-list">
        <article>
          <div className="child-avatar child-avatar-one">하</div>
          <div>
            <span className="status-chip active">재원 중</span>
            <strong>김하린 · Harin</strong>
            <small>2019. 09. 18 · 보호자 2명 연결</small>
          </div>
          <button onClick={startLifecycleAction} type="button">
            {isDirector ? '재원 관리' : '처리 요청'}
          </button>
        </article>
        <article>
          <div className="child-avatar child-avatar-two">준</div>
          <div>
            <span className="status-chip active">재원 중</span>
            <strong>박서준 · Jun</strong>
            <small>2019. 11. 02 · 보호자 1명 연결</small>
          </div>
          <button
            onClick={() => onToast('서준이의 기본 정보 화면을 열었어요.')}
            type="button"
          >
            보기
          </button>
        </article>
      </section>

      {isDirector && (
        <section className="archive-demo">
          <header>
            <div>
              <span>보관함</span>
              <h2>졸업·퇴원 처리 내역</h2>
            </div>
            <strong>1명</strong>
          </header>
          <article>
            <span className="archive-icon">
              <Icon name="archive" size={23} />
            </span>
            <div>
              <strong>이도윤 · 7월 25일 퇴원</strong>
              <small>복구 가능 · 영구 삭제 예약까지 25일</small>
            </div>
            <div className="archive-actions">
              <button
                onClick={() =>
                  onToast('도윤이의 재원 기록을 복구했습니다. (데모)')
                }
                type="button"
              >
                <Icon name="restore" size={18} />
                복원
              </button>
              <button
                className="archive-delete-button"
                onClick={() =>
                  onSafetyAction({
                    title: '도윤이의 데이터 영구 삭제를 예약할까요?',
                    description:
                      '재원 종료와 접근 중지가 끝난 뒤에만 가능한 마지막 단계입니다. 실행 전 30일 동안 원장이 취소할 수 있습니다.',
                    actionLabel: '30일 후 영구 삭제 예약',
                    targetLabel: '이도윤 · 다람쥐반 · 원아번호 GT-0988',
                    confirmationText: '영구삭제',
                    impacts: [
                      '예약 후 30일 동안 취소하거나 복원할 수 있습니다.',
                      '실제 삭제가 끝나면 앱에서 사진과 개인정보를 복구할 수 없습니다.',
                      '보호자가 이미 저장하거나 공유한 사본은 앱에서 회수할 수 없습니다.',
                      '실행자·사유·대상·시간은 개인정보를 제외한 관리 기록에 남습니다.',
                    ],
                    mode: 'schedule',
                  })
                }
                type="button"
              >
                삭제 예약
              </button>
            </div>
          </article>
          <p>
            일괄 졸업 처리는 가능하지만, 일괄 영구 삭제 기능은 만들지 않습니다.
          </p>
        </section>
      )}
    </div>
  )
}

function StaffPermissions({
  onSafetyAction,
}: {
  onSafetyAction: (action: SafetyAction) => void
}) {
  const permissions = [
    { title: '전체 공지 작성', enabled: true },
    { title: '식단표 작성', enabled: false },
    { title: '담당 반 사진 게시', enabled: true },
    { title: '재원 종료 요청', enabled: true },
  ]

  return (
    <div className="content-stack">
      <section className="staff-card">
        <div className="teacher-avatar large">봄</div>
        <div>
          <span>판다반 담임</span>
          <strong>이새봄 선생님</strong>
          <small>권한 만료 · 2027년 2월 28일</small>
        </div>
        <span className="status-chip active">근무 중</span>
      </section>

      <section className="settings-list permission-settings">
        <header>
          <span>세부 권한</span>
          <strong>필요한 기능만 허용</strong>
        </header>
        {permissions.map((permission) => (
          <div className="setting-row" key={permission.title}>
            <span className="setting-icon">
              <Icon name="shield" size={22} />
            </span>
            <div>
              <strong>{permission.title}</strong>
              <small>
                {permission.enabled ? '현재 허용됨' : '현재 허용되지 않음'}
              </small>
            </div>
            <button
              aria-pressed={permission.enabled}
              className={`toggle ${permission.enabled ? 'on' : ''}`}
              onClick={() =>
                onSafetyAction({
                  title: '교사 권한을 변경할까요?',
                  description:
                    '권한을 바꾸기 전 현재 범위와 변경 후 범위를 비교합니다.',
                  actionLabel: '권한 변경 예약',
                  targetLabel: `이새봄 선생님 · ${permission.title}`,
                  confirmationText: '이새봄',
                  impacts: [
                    '교사는 스스로 권한을 부여할 수 없습니다.',
                    '권한은 담당 반과 유효기간 범위에서만 적용됩니다.',
                    '변경 전후 값과 변경한 원장이 관리 기록에 남습니다.',
                  ],
                  mode: 'schedule',
                })
              }
              type="button"
            >
              <span />
            </button>
          </div>
        ))}
      </section>

      <section className="staff-lifecycle-actions">
        <div>
          <span>계정과 근무 기록은 따로 관리</span>
          <strong>퇴사·휴직·기기 분실 시 접근 관리</strong>
        </div>
        <button
          onClick={() =>
            onSafetyAction({
              title: '이새봄 선생님의 앱 접근을 중지할까요?',
              description:
                '접근 중지는 계정 영구 삭제가 아니며 원장이 즉시 복구할 수 있습니다.',
              actionLabel: '앱 접근 중지',
              targetLabel: '이새봄 교사 · 판다반 담당',
              confirmationText: '이새봄',
              impacts: [
                '현재 로그인된 기기에서 유치원 자료 접근이 즉시 차단됩니다.',
                '담당 반 배정과 위임 권한은 일시 중지됩니다.',
                '기기의 얼굴 프로필과 유치원 캐시를 정리하도록 요청합니다.',
                '근무 기록과 작성한 공지는 삭제되지 않습니다.',
              ],
              mode: 'schedule',
            })
          }
          type="button"
        >
          접근 중지 검토
        </button>
      </section>

      <aside className="danger-zone-note">
        <Icon name="warning" size={22} />
        <div>
          <strong>교사는 계정을 영구 삭제할 수 없어요</strong>
          <span>
            교사 접근 중지는 원장이 복구할 수 있으며, 마지막 원장은 다른 원장에게
            권한을 넘기기 전 스스로 계정을 중지할 수 없습니다.
          </span>
        </div>
      </aside>
    </div>
  )
}

function PhotoUpload({ onToast }: { onToast: (message: string) => void }) {
  const steps = [
    { number: 1, title: '단체 사진 선택', detail: '한 번에 150장 이상도 준비' },
    { number: 2, title: '기기 안에서 AI 분류', detail: '얼굴 특징값 외부 전송 없음' },
    { number: 3, title: '선생님이 직접 검토', detail: '불확실한 사진만 모아 확인' },
    { number: 4, title: '해당 보호자에게 게시', detail: '자동 게시하지 않음' },
  ]

  return (
    <div className="content-stack">
      <section className="photo-workflow-hero">
        <span>
          <Icon name="upload" size={29} />
        </span>
        <p>GIVING TREE PHOTO GARDEN</p>
        <h2>사진은 선생님 확인 후에만 게시돼요</h2>
        <p>
          기존 사진 분류 기능을 그대로 살리고, 부모는 연결된 아이의 검토 완료
          사진만 볼 수 있게 설계합니다.
        </p>
      </section>

      <section className="workflow-steps">
        {steps.map((step) => (
          <article key={step.number}>
            <span>{step.number}</span>
            <div>
              <strong>{step.title}</strong>
              <small>{step.detail}</small>
            </div>
            <Icon name="check" size={20} />
          </article>
        ))}
      </section>

      <div className="photo-action-grid">
        <a
          className="primary-button"
          href="https://giving-tree-app.github.io/"
          rel="noreferrer"
          target="_blank"
        >
          현재 사진 분류기 열기
        </a>
        <button
          className="outline-button"
          onClick={() =>
            onToast('통합 업로드 화면은 사진 기능 통합 단계에서 연결합니다.')
          }
          type="button"
        >
          통합 화면 미리보기
        </button>
      </div>

      <aside className="permission-note">
        <Icon name="lock" size={20} />
        <span>
          <strong>현재 운영 중인 사진 분류 사이트는 그대로 유지됩니다</strong>
          이 화면은 새 유치원 앱 개발 브랜치의 무료 UI 시제품입니다.
        </span>
      </aside>
    </div>
  )
}

function PhotoStatus() {
  return (
    <div className="content-stack">
      <section className="status-overview">
        <article>
          <span>오늘 업로드</span>
          <strong>186</strong>
          <small>장</small>
        </article>
        <article>
          <span>검토 필요</span>
          <strong>12</strong>
          <small>장</small>
        </article>
        <article>
          <span>게시 완료</span>
          <strong>154</strong>
          <small>장</small>
        </article>
      </section>

      <section className="review-queue">
        <header>
          <div>
            <span>교사 확인 대기</span>
            <h2>자동으로 게시되지 않아요</h2>
          </div>
          <strong>12장</strong>
        </header>
        <div className="review-thumbnails">
          {Array.from({ length: 6 }, (_, index) => (
            <span className={`review-thumb tone-${(index % 3) + 1}`} key={index}>
              <Icon name="photo" size={22} />
            </span>
          ))}
        </div>
        <p>여러 아이가 함께 나온 사진은 모든 아이의 동의 상태를 확인합니다.</p>
      </section>
    </div>
  )
}

function ChildAlbum() {
  return (
    <div className="content-stack">
      <section className="child-switcher">
        <div className="child-avatar child-avatar-one">하</div>
        <div>
          <span>현재 보고 있는 아이</span>
          <strong>김하린 · 판다반</strong>
        </div>
        <button type="button">
          아이 바꾸기
          <Icon name="chevron" size={18} />
        </button>
      </section>

      <section className="album-summary">
        <div>
          <p>7월의 사진</p>
          <h2>새로운 추억 8장이 도착했어요</h2>
        </div>
        <span>총 46장</span>
      </section>

      <section className="album-grid" aria-label="아이 사진첩 데모">
        {Array.from({ length: 8 }, (_, index) => (
          <button className={`album-placeholder album-${(index % 4) + 1}`} key={index}>
            <span className="album-leaf" />
            <small>{index < 8 ? 'NEW' : ''}</small>
          </button>
        ))}
      </section>

      <aside className="privacy-reminder compact">
        <span>
          <Icon name="photo" size={20} />
        </span>
        <div>
          <strong>카카오톡 공유는 20장씩 안전하게 나눠요</strong>
          <p>50장은 20장·20장·10장, 100장은 20장씩 5번 공유합니다.</p>
        </div>
      </aside>
    </div>
  )
}

function AuditLog() {
  const events = [
    {
      title: '가입 신청 검토',
      detail: '김나무 원장 · 박지우 보호자 신청 열람',
      time: '오늘 10:32',
    },
    {
      title: '공지 작성 권한 변경',
      detail: '김나무 원장 · 이새봄 교사 · 허용',
      time: '오늘 09:14',
    },
    {
      title: '사진 게시 완료',
      detail: '이새봄 교사 · 판다반 · 42장',
      time: '어제 16:08',
    },
    {
      title: '재원 종료 요청 취소',
      detail: '김나무 원장 · 이도윤 · 복구됨',
      time: '7월 25일',
    },
  ]

  return (
    <div className="content-stack">
      <aside className="permission-note">
        <Icon name="history" size={20} />
        <span>
          <strong>관리 기록은 수정하거나 지울 수 없어요</strong>
          대상·작업자·시간·변경 전후 값을 남기며 비밀번호나 얼굴 특징값은
          기록하지 않습니다.
        </span>
      </aside>
      <section className="audit-list">
        {events.map((event) => (
          <article key={`${event.title}-${event.time}`}>
            <span className="audit-dot" />
            <div>
              <time>{event.time}</time>
              <strong>{event.title}</strong>
              <small>{event.detail}</small>
            </div>
          </article>
        ))}
      </section>
    </div>
  )
}

function Profile({
  role,
  onLogout,
  onReplayIntro,
}: {
  role: Role
  onLogout: () => void
  onReplayIntro: () => void
}) {
  return (
    <div className="content-stack">
      <section className="profile-card">
        <div className="profile-avatar">
          <Icon name="profile" size={30} />
        </div>
        <div>
          <span>{ROLE_LABELS[role]} 데모 계정</span>
          <strong>
            {role === 'director' && '김나무 원장님'}
            {role === 'teacher' && '이새봄 선생님'}
            {role === 'parent' && '하린이 보호자님'}
          </strong>
          <small>Giving Tree · 무료 UI 시제품</small>
        </div>
      </section>

      <section className="profile-menu">
        <button onClick={onReplayIntro} type="button">
          <span>
            <Icon name="leaf" size={21} />
          </span>
          <strong>인트로 다시 보기</strong>
          <Icon name="chevron" size={20} />
        </button>
        <button type="button">
          <span>
            <Icon name="lock" size={21} />
          </span>
          <strong>개인정보와 보관 정책</strong>
          <Icon name="chevron" size={20} />
        </button>
        <button type="button">
          <span>
            <Icon name="shield" size={21} />
          </span>
          <strong>로그인된 기기 관리</strong>
          <Icon name="chevron" size={20} />
        </button>
      </section>

      <section className="free-scope-card">
        <p>현재 비용 0원 범위</p>
        <h2>서버·문자·스토어 결제 없이 UI만 개발 중이에요</h2>
        <ul>
          <li>React·TypeScript·CSS/SVG 화면</li>
          <li>가상 데이터와 역할별 권한 미리보기</li>
          <li>졸업·퇴원·위험 작업 안전 흐름</li>
        </ul>
        <span>
          SMS, 클라우드 사진 저장, 실제 푸시, 앱스토어 등록은 연결 전에 예상
          비용을 먼저 안내합니다.
        </span>
      </section>

      <button className="logout-button" onClick={onLogout} type="button">
        데모 로그아웃
      </button>
    </div>
  )
}

export function MenuScreen({
  menu,
  role,
  onBack,
  onOpenMenu,
  onSafetyAction,
  onToast,
  onLogout,
  onReplayIntro,
}: MenuScreenProps) {
  let content: React.ReactNode

  switch (menu) {
    case 'global-notices':
      content = <GlobalNotices onToast={onToast} role={role} />
      break
    case 'class-note':
      content = <ClassNote role={role} />
      break
    case 'meals':
      content = <MealMenu role={role} />
      break
    case 'notifications':
      content = <NotificationSettings onToast={onToast} />
      break
    case 'approvals':
      content = <Approvals onSafetyAction={onSafetyAction} />
      break
    case 'children':
    case 'class-children':
      content = (
        <ChildLifecycle
          onSafetyAction={onSafetyAction}
          onToast={onToast}
          role={role}
        />
      )
      break
    case 'staff':
      content = <StaffPermissions onSafetyAction={onSafetyAction} />
      break
    case 'upload-photos':
      content = <PhotoUpload onToast={onToast} />
      break
    case 'photo-status':
      content = <PhotoStatus />
      break
    case 'child-album':
      content = <ChildAlbum />
      break
    case 'audit':
      content = <AuditLog />
      break
    case 'profile':
      content = (
        <Profile
          onLogout={onLogout}
          onReplayIntro={onReplayIntro}
          role={role}
        />
      )
      break
    default:
      content = (
        <div className="empty-state">
          <Icon name="leaf" size={34} />
          <h2>화면을 준비하고 있어요</h2>
          <p>다음 개발 단계에서 실제 데이터와 연결합니다.</p>
          <button onClick={() => onOpenMenu('global-notices')} type="button">
            공지사항 미리보기
          </button>
        </div>
      )
  }

  return (
    <main className="app-main menu-main">
      <PageHeader
        eyebrow={`${ROLE_LABELS[role]} · Giving Tree`}
        onBack={onBack}
        title={MENU_TITLES[menu]}
      />
      <div className="page-content">{content}</div>
    </main>
  )
}
