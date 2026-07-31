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
import { MENUS_BY_ROLE, MENU_TITLES } from './data'
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
  if (typeof globalThis.window === 'undefined') {
    return 'splash'
  }

  const browserWindow = globalThis.window
  const raw = browserWindow.location.hash.replace(/^#\/?/, '')

  if (!raw) {
    return browserWindow.localStorage.getItem('gt-kindergarten-intro-seen')
      ? 'welcome'
      : 'splash'
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
  if (typeof globalThis.window === 'undefined') {
    return null
  }

  const stored = globalThis.window.sessionStorage.getItem(
    'gt-kindergarten-demo-role',
  )
  return stored === 'director' || stored === 'teacher' || stored === 'parent'
    ? stored
    : null
}

function App() {
  const [screen, setScreen] = useState<AppScreen>('splash')
  const [role, setRole] = useState<Role | null>(null)
  const [safetyAction, setSafetyAction] = useState<SafetyAction | null>(null)
  const [toast, setToast] = useState('')

  const navigate = useCallback(
    (destination: AppScreen, options?: { replace?: boolean }) => {
      const nextHash = `#/${destination}`

      if (options?.replace) {
        window.history.replaceState(null, '', nextHash)
        setScreen(destination)
      } else if (window.location.hash === nextHash) {
        setScreen(destination)
      } else {
        window.location.hash = nextHash
      }

      const reducedMotion = window.matchMedia(
        '(prefers-reduced-motion: reduce)',
      ).matches
      window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' })
    },
    [],
  )

  useEffect(() => {
    const handleHashChange = () => setScreen(parseScreen())
    window.addEventListener('hashchange', handleHashChange)

    const initialStateTimer = window.setTimeout(() => {
      const initialScreen = parseScreen()
      setScreen(initialScreen)
      setRole(loadDemoRole())

      if (!window.location.hash) {
        window.history.replaceState(null, '', `#/${initialScreen}`)
      }
    }, 0)

    return () => {
      window.clearTimeout(initialStateTimer)
      window.removeEventListener('hashchange', handleHashChange)
    }
  }, [])

  useEffect(() => {
    if (screen !== 'splash') {
      return
    }

    const reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches
    const timer = window.setTimeout(
      () => {
        window.localStorage.setItem('gt-kindergarten-intro-seen', 'true')
        navigate('welcome', { replace: true })
      },
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

  const skipIntro = () => {
    window.localStorage.setItem('gt-kindergarten-intro-seen', 'true')
    navigate('welcome', { replace: true })
  }

  const openMenu = (menu: MenuKey) => navigate(`menu/${menu}`)

  const confirmSafetyAction = (action: SafetyAction) => {
    setSafetyAction(null)
    setToast(
      action.successMessage ??
        (action.mode === 'request'
          ? '원장 확인 요청을 만들었어요. 실제 데이터는 변경되지 않았습니다.'
          : '검토 작업을 완료했어요. 실제 데이터는 변경되지 않았습니다.'),
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

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (protectedScreen && !role) {
        navigate('welcome', { replace: true })
        return
      }

      if (requestedMenu && !menuAllowed) {
        setToast('이 계정에는 해당 메뉴를 열 권한이 없어요.')
        navigate('home', { replace: true })
      }
    }, 0)

    return () => {
      window.clearTimeout(timer)
    }
  }, [
    menuAllowed,
    navigate,
    protectedScreen,
    requestedMenu,
    role,
  ])

  useEffect(() => {
    const requestedVisibleMenu = visibleScreen.startsWith('menu/')
      ? (visibleScreen.slice('menu/'.length) as MenuKey)
      : null
    const pageTitle = requestedVisibleMenu
      ? MENU_TITLES[requestedVisibleMenu]
      : visibleScreen === 'home'
        ? '홈'
        : visibleScreen === 'signup'
          ? '가입 신청'
          : visibleScreen === 'login'
            ? '로그인'
            : 'Giving Tree'

    document.title = `${pageTitle} · Giving Tree`

    const frame = window.requestAnimationFrame(() => {
      const heading = document.querySelector<HTMLElement>(
        '.kindergarten-app main h1',
      )
      if (heading) {
        heading.tabIndex = -1
        heading.focus({ preventScroll: true })
      }
    })

    return () => window.cancelAnimationFrame(frame)
  }, [visibleScreen])

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
    <div className="kindergarten-app" data-screen={visibleScreen}>
      {visibleScreen === 'splash' && (
        <SplashScreen onSkip={skipIntro} />
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

      <span className="sr-only" aria-live="polite">
        {visibleScreen.startsWith('menu/')
          ? MENU_TITLES[visibleScreen.slice('menu/'.length) as MenuKey]
          : visibleScreen === 'home'
            ? '홈 화면'
            : ''}
      </span>

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
