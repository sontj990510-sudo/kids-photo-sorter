export type Role = 'director' | 'teacher' | 'parent'

export type MenuKey =
  | 'approvals'
  | 'children'
  | 'staff'
  | 'global-notices'
  | 'class-note'
  | 'meals'
  | 'photo-status'
  | 'upload-photos'
  | 'class-children'
  | 'child-album'
  | 'notifications'
  | 'audit'
  | 'profile'

export type AppScreen =
  | 'splash'
  | 'welcome'
  | 'login'
  | 'signup'
  | 'pending'
  | 'home'
  | `menu/${MenuKey}`

export type IconName =
  | 'approval'
  | 'people'
  | 'shield'
  | 'notice'
  | 'note'
  | 'meal'
  | 'photo'
  | 'upload'
  | 'bell'
  | 'history'
  | 'profile'
  | 'home'
  | 'back'
  | 'lock'
  | 'leaf'
  | 'chevron'
  | 'check'
  | 'warning'
  | 'archive'
  | 'restore'

export type MenuItem = {
  key: MenuKey
  label: string
  eyebrow: string
  icon: IconName
  tone: 'leaf' | 'sun' | 'sky' | 'berry' | 'wood' | 'mint'
  badge?: number
}

export type SafetyAction = {
  title: string
  description: string
  actionLabel: string
  targetLabel: string
  confirmationText: string
  impacts: string[]
  mode: 'request' | 'schedule'
  severity?: 'review' | 'critical'
  successMessage?: string
}
