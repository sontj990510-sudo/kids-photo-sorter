import { MENUS_BY_ROLE, ROLE_HOME_COPY, ROLE_LABELS } from '../data'
import { Icon } from '../components/Icon'
import { TreeLogo } from '../components/TreeLogo'
import type { MenuKey, Role } from '../types'

export function HomeScreen({
  role,
  onOpenMenu,
  onRoleChange,
}: {
  role: Role
  onOpenMenu: (menu: MenuKey) => void
  onRoleChange: (role: Role) => void
}) {
  const copy = ROLE_HOME_COPY[role]
  const menus = MENUS_BY_ROLE[role]

  return (
    <main className="app-main home-main">
      <div className="home-forest-art" aria-hidden="true">
        <span className="home-sun" />
        <span className="home-hill home-hill-back" />
        <span className="home-hill home-hill-front" />
        <span className="home-tree home-tree-left" />
        <span className="home-tree home-tree-right" />
      </div>

      <header className="app-header">
        <div className="header-brand">
          <TreeLogo compact />
          <div>
            <span>KINDERGARTEN</span>
            <strong>Giving Tree</strong>
          </div>
        </div>
        <button
          aria-label="알림 모아보기, 새 소식 4개"
          className="header-alert-button"
          onClick={() => onOpenMenu('notifications')}
          type="button"
        >
          <Icon name="bell" size={23} />
          <span aria-hidden="true" />
        </button>
      </header>

      <section className="home-welcome">
        <div className="welcome-text">
          <span className="weather-pill">
            <Icon name="leaf" size={15} />
            7월 30일 · 맑음
          </span>
          <h1>{copy.greeting}</h1>
          <p>{copy.subcopy}</p>
        </div>
        <div className="tiny-tree-scene" aria-hidden="true">
          <span className="tiny-tree-crown" />
          <span className="tiny-tree-trunk" />
          <span className="tiny-tree-ground" />
        </div>
      </section>

      <section className="demo-role-switcher" aria-label="데모 역할 바꾸기">
        <div>
          <small>개발용 미리보기</small>
          <strong>{ROLE_LABELS[role]} 화면</strong>
        </div>
        <div>
          {(['director', 'teacher', 'parent'] as Role[]).map((item) => (
            <button
              aria-pressed={role === item}
              className={role === item ? 'active' : ''}
              key={item}
              onClick={() => onRoleChange(item)}
              type="button"
            >
              {ROLE_LABELS[item]}
            </button>
          ))}
        </div>
      </section>

      <section className="menu-section">
        <div className="section-heading">
          <div>
            <p>MY GARDEN</p>
            <h2>무엇을 확인할까요?</h2>
          </div>
          <span>{menus.length}개 메뉴</span>
        </div>

        <div className="menu-grid">
          {menus.map((menu, index) => (
            <button
              className={`menu-tile tone-${menu.tone}`}
              key={menu.key}
              onClick={() => onOpenMenu(menu.key)}
              style={{ '--tile-delay': `${index * 45}ms` } as React.CSSProperties}
              type="button"
            >
              <span className="menu-icon-wrap">
                <Icon name={menu.icon} size={29} />
                {menu.badge && <i>{menu.badge}</i>}
              </span>
              <span className="menu-copy">
                <small>{menu.eyebrow}</small>
                <strong>{menu.label}</strong>
              </span>
              <span className="menu-chevron">
                <Icon name="chevron" size={19} />
              </span>
            </button>
          ))}
        </div>
      </section>

      <aside className="privacy-reminder">
        <span>
          <Icon name="lock" size={20} />
        </span>
        <div>
          <strong>아이 정보는 꼭 필요한 사람에게만</strong>
          <p>역할과 담당 반에 따라 볼 수 있는 메뉴가 달라집니다.</p>
        </div>
      </aside>
    </main>
  )
}

export function BottomNavigation({
  active,
  onHome,
  onNotifications,
  onProfile,
}: {
  active: 'home' | 'notifications' | 'profile'
  onHome: () => void
  onNotifications: () => void
  onProfile: () => void
}) {
  const items = [
    { key: 'home', label: '홈', icon: 'home' as const, action: onHome },
    {
      key: 'notifications',
      label: '알림',
      icon: 'bell' as const,
      action: onNotifications,
    },
    {
      key: 'profile',
      label: '내 정보',
      icon: 'profile' as const,
      action: onProfile,
    },
  ]

  return (
    <nav className="bottom-navigation" aria-label="주요 메뉴">
      {items.map((item) => (
        <button
          aria-label={
            item.key === 'notifications'
              ? '알림, 새 소식 4개'
              : item.label
          }
          aria-current={active === item.key ? 'page' : undefined}
          className={active === item.key ? 'active' : ''}
          key={item.key}
          onClick={item.action}
          type="button"
        >
          <span>
            <Icon name={item.icon} size={23} />
            {item.key === 'notifications' && <i aria-hidden="true" />}
          </span>
          <small>{item.label}</small>
        </button>
      ))}
    </nav>
  )
}
