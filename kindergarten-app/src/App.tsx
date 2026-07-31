import { useCallback, useEffect, useState } from 'react'
import {
  LoginScreen,
  PendingScreen,
  SignupScreen,
  SplashScreen,
  WelcomeScreen,
} from './screens/AuthScreens'
import { BottomNavigation, HomeScreen } from './screens/HomeScreen'
import { MenuScreen } from './screens/MenuScreen'
import { SafetyDialog } from './components/SafetyDialog'
import { MENUS_BY_ROLE } from './data'
import type { AppScreen, MenuKey, Role, SafetyAction } from './types'

const VALID_MENUS = new Set<MenuKey>([
  'approvals',
  'children',
  'staff',
  'global-notices',
  'class-note',
  'meals',
  'photo-status',
  'upload-photos',
  'class-children',
  'child-album',
  'notifications',
  'audit',
  'profile',
])

function parseScreen(): AppScreen {
  const raw = window.location.hash.replace(/^#\/?/, '')

  if (!raw) {
    return 'splash'
  }

  if (raw.startsWith('menu/')) {
    const menu = raw.slice('menu/'.length) as MenuKey
    return VALID_MENUS.has(menu) ? `menu/${menu}` : 'home'
  }

  if (
    raw === 'splash' ||
    raw === 'welcome' ||
    raw === 'login' ||
    raw === 'signup' ||
    raw === 'pending' ||
    raw === 'home'
  ) {
    return raw
  }

  return 'welcome'
}

function loadDemoRole(): Role | null {
  const stored = window.sessionStorage.getItem('gt-kindergarten-demo-role')
  return stored === 'director' || stored === 'teacher' || stored === 'parent'
    ? stored
    : null
}

function App() {
  const [screen, setScreen] = useState<AppScreen>(parseScreen)
  const [role, setRole] = useState<Role | null>(loadDemoRole)
  const [safetyAction, setSafetyAction] = useState<SafetyAction | null>(null)
  const [toast, setToast] = useState('')

  const navigate = useCallback((destination: AppScreen) => {
    const nextHash = `#/${destination}`
    if (window.location.hash === nextHash) {
      setScreen(destination)
    } else {
      window.location.hash = nextHash
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  useEffect(() => {
    const handleHashChange = () => setScreen(parseScreen())
    window.addEventListener('hashchange', handleHashChange)

    if (!window.location.hash) {
      window.location.hash = '#/splash'
    }

    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  useEffect(() => {
    if (screen !== 'splash') {
      return
    }

    const reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches
    const timer = window.setTimeout(
      () => navigate('welcome'),
      reducedMotion ? 450 : 1900,
    )

    return () => window.clearTimeout(timer)
  }, [navigate, screen])

  useEffect(() => {
    if (!toast) {
      return
    }

    const timer = window.setTimeout(() => setToast(''), 4200)
    return () => window.clearTimeout(timer)
  }, [toast])

  const loginAs = (nextRole: Role) => {
    window.sessionStorage.setItem('gt-kindergarten-demo-role', nextRole)
    setRole(nextRole)
    navigate('home')
  }

  const changeRole = (nextRole: Role) => {
    window.sessionStorage.setItem('gt-kindergarten-demo-role', nextRole)
    setRole(nextRole)
    setToast(`${nextRole === 'director' ? '원장' : nextRole === 'teacher' ? '교사' : '학부모'} 화면으로 바꿨어요.`)
    navigate('home')
  }

  const logout = () => {
    window.sessionStorage.removeItem('gt-kindergarten-demo-role')
    setRole(null)
    setToast('')
    navigate('welcome')
  }

  const replayIntro = () => {
    navigate('splash')
  }

  const openMenu = (menu: MenuKey) => navigate(`menu/${menu}`)

  const confirmSafetyAction = (action: SafetyAction) => {
    setSafetyAction(null)
    setToast(
      action.mode === 'request'
        ? '원장 확인 요청을 만들었어요. 실제 데이터는 변경되지 않았습니다.'
        : '복구 가능한 예약을 만들었어요. 실제 데이터는 변경되지 않았습니다.',
    )
  }

  const protectedScreen = screen === 'home' || screen.startsWith('menu/')
  const requestedMenu = screen.startsWith('menu/')
    ? (screen.slice('menu/'.length) as MenuKey)
    : null
  const menuAllowed =
    role &&
    requestedMenu &&
    (requestedMenu === 'notifications' ||
      requestedMenu === 'profile' ||
      MENUS_BY_ROLE[role].some((item) => item.key === requestedMenu))
  const visibleScreen =
    protectedScreen && !role
      ? 'welcome'
      : requestedMenu && !menuAllowed
        ? 'home'
        : screen

  const bottomNavigation =
    role && (visibleScreen === 'home' || visibleScreen.startsWith('menu/')) ? (
      <BottomNavigation
        active={
          visibleScreen === 'menu/notifications'
            ? 'notifications'
            : visibleScreen === 'menu/profile'
              ? 'profile'
              : 'home'
        }
        onHome={() => navigate('home')}
        onNotifications={() => openMenu('notifications')}
        onProfile={() => openMenu('profile')}
      />
    ) : null

  return (
    <div className="kindergarten-app">
      {visibleScreen === 'splash' && (
        <SplashScreen onSkip={() => navigate('welcome')} />
      )}

      {visibleScreen === 'welcome' && (
        <WelcomeScreen
          navigate={navigate}
          onDemoLogin={loginAs}
          onReplayIntro={replayIntro}
        />
      )}

      {visibleScreen === 'login' && (
        <LoginScreen navigate={navigate} onLogin={loginAs} />
      )}

      {visibleScreen === 'signup' && <SignupScreen navigate={navigate} />}

      {visibleScreen === 'pending' && <PendingScreen navigate={navigate} />}

      {visibleScreen === 'home' && role && (
        <HomeScreen
          onOpenMenu={openMenu}
          onRoleChange={changeRole}
          role={role}
        />
      )}

      {visibleScreen.startsWith('menu/') && role && (
        <MenuScreen
          menu={visibleScreen.slice('menu/'.length) as MenuKey}
          onBack={() => navigate('home')}
          onLogout={logout}
          onOpenMenu={openMenu}
          onReplayIntro={replayIntro}
          onSafetyAction={setSafetyAction}
          onToast={setToast}
          role={role}
        />
      )}

      {bottomNavigation}

      <SafetyDialog
        action={safetyAction}
        onCancel={() => setSafetyAction(null)}
        onConfirm={confirmSafetyAction}
      />

      {toast && (
        <div className="toast" role="status">
          <span>✓</span>
          <p>{toast}</p>
          <button aria-label="메시지 닫기" onClick={() => setToast('')} type="button">
            ×
          </button>
        </div>
      )}
    </div>
  )
}

export default App
