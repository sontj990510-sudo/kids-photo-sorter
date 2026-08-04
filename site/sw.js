const DEFAULT_URL = '/#/menu/notifications'
const STATIC_ALLOWED_URLS = new Set([
  '/#/menu/notifications',
  '/#/menu/global-notices',
  '/#/menu/meals',
  '/#/menu/child-album',
  '/#/menu/calendar',
])
const ATTENDANCE_SOURCE_TYPE = 'child_attendance_notice'
const ATTENDANCE_EVENT_KINDS = new Set([
  'attendance_submitted',
  'attendance_updated',
  'attendance_cancelled',
])
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ATTENDANCE_ACTION_URL_PATTERN =
  /^\/#\/menu\/(attendance|children|class-children)\?notice=([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i

function attendanceTitle(eventKind) {
  if (eventKind === 'attendance_updated') {
    return '출결·등하원 알림이 변경됐어요'
  }
  if (eventKind === 'attendance_cancelled') {
    return '출결·등하원 알림이 취소됐어요'
  }
  if (eventKind === 'attendance_submitted') {
    return '새 출결·등하원 알림이 도착했어요'
  }
  return '출결·등하원 알림이 있어요'
}

function storedActionUrl(value) {
  if (STATIC_ALLOWED_URLS.has(value)) return value
  if (
    typeof value === 'string' &&
    ATTENDANCE_ACTION_URL_PATTERN.test(value)
  ) {
    return value
  }
  return DEFAULT_URL
}

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = {}
  }
  const isAttendance =
    payload.category === 'attendance' ||
    payload.source_type === ATTENDANCE_SOURCE_TYPE
  const attendanceEventKind =
    typeof payload.event_kind === 'string' &&
    ATTENDANCE_EVENT_KINDS.has(payload.event_kind)
      ? payload.event_kind
      : null
  const noticeId =
    typeof payload.notice_id === 'string' &&
    UUID_PATTERN.test(payload.notice_id)
      ? payload.notice_id
      : null
  const attendanceActionMatch =
    typeof payload.action_url === 'string'
      ? ATTENDANCE_ACTION_URL_PATTERN.exec(payload.action_url)
      : null
  const actionUrl = isAttendance && noticeId &&
      attendanceActionMatch?.[2] === noticeId
    ? payload.action_url
    : STATIC_ALLOWED_URLS.has(payload.action_url)
      ? payload.action_url
      : DEFAULT_URL
  const title = isAttendance
    ? attendanceTitle(attendanceEventKind)
    : typeof payload.title === 'string' && payload.title
      ? payload.title
      : 'Giving Tree 새 알림'
  const body = isAttendance
    ? 'Giving Tree 앱에서 안전하게 확인해 주세요.'
    : typeof payload.body === 'string' && payload.body
      ? payload.body
      : 'Giving Tree 앱에서 내용을 확인해 주세요.'
  const attendanceNotificationId =
    typeof payload.notification_id === 'string' &&
    UUID_PATTERN.test(payload.notification_id)
      ? payload.notification_id
      : null
  const tag = isAttendance
    ? attendanceNotificationId
      ? `giving-tree-attendance-${attendanceNotificationId}`
      : 'giving-tree-attendance'
    : typeof payload.tag === 'string' && payload.tag
      ? payload.tag
      : 'giving-tree-notification'

  event.waitUntil(self.registration.showNotification(title, {
    body,
    icon: '/app-icon-192.png',
    badge: '/app-badge-96.png',
    tag,
    renotify: isAttendance,
    requireInteraction: isAttendance,
    data: { actionUrl },
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const requested = event.notification.data?.actionUrl
  const actionUrl = storedActionUrl(requested)
  const target = new URL(actionUrl, self.location.origin)

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    })
    for (const client of windows) {
      if ('navigate' in client) await client.navigate(target.href)
      if ('focus' in client) return client.focus()
    }
    return self.clients.openWindow(target.href)
  })())
})
