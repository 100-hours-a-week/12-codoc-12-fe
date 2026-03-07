/* global importScripts, firebase */

importScripts('https://www.gstatic.com/firebasejs/11.0.2/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/11.0.2/firebase-messaging-compat.js')

const NOTIFICATION_LOGO_PATH = '/notification-icon.png'

const LINK_CODE_PATHS = {
  HOME: '/',
  MY: '/my',
  LEADERBOARD: '/leaderboard',
  CHAT: '/chat',
}

const parseLinkParams = (value) => {
  if (!value) {
    return {}
  }

  if (typeof value === 'object' && !Array.isArray(value)) {
    return value
  }

  if (typeof value !== 'string') {
    return {}
  }

  try {
    const parsed = JSON.parse(value)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed
    }
  } catch {
    return {}
  }

  return {}
}

const resolveLegacyLink = (linkUrl) => {
  if (!linkUrl || typeof linkUrl !== 'string') {
    return null
  }

  if (/^https?:\/\//i.test(linkUrl)) {
    return linkUrl
  }

  if (!linkUrl.startsWith('/')) {
    return `/${linkUrl}`
  }

  return linkUrl
}

const resolvePathByLinkCode = (linkCode, linkParams = {}) => {
  if (!linkCode || typeof linkCode !== 'string') {
    return null
  }

  if (linkCode === 'PROBLEM_DETAIL') {
    const rawProblemId = linkParams?.problemId

    if (rawProblemId === null || rawProblemId === undefined) {
      return '/problems'
    }

    const problemId = String(rawProblemId).trim()
    if (!problemId) {
      return '/problems'
    }

    return `/problems/${encodeURIComponent(problemId)}`
  }

  if (linkCode === 'CHAT') {
    const rawRoomId = linkParams?.roomId
    if (rawRoomId !== null && rawRoomId !== undefined) {
      const roomId = String(rawRoomId).trim()
      if (roomId) {
        return `/chat/${encodeURIComponent(roomId)}`
      }
    }
    return '/chat'
  }

  return LINK_CODE_PATHS[linkCode] ?? null
}

const resolveTargetLink = ({ linkCode, linkParams, linkUrl }) =>
  resolvePathByLinkCode(linkCode, linkParams) ?? resolveLegacyLink(linkUrl) ?? '/'

const params = new URL(self.location.href).searchParams

const firebaseConfig = {
  apiKey: params.get('apiKey') ?? '',
  authDomain: params.get('authDomain') ?? '',
  projectId: params.get('projectId') ?? '',
  storageBucket: params.get('storageBucket') ?? '',
  messagingSenderId: params.get('messagingSenderId') ?? '',
  appId: params.get('appId') ?? '',
}

const hasRequiredConfig =
  firebaseConfig.apiKey &&
  firebaseConfig.projectId &&
  firebaseConfig.messagingSenderId &&
  firebaseConfig.appId

let messaging = null

if (hasRequiredConfig) {
  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig)
    }

    messaging = firebase.messaging()
  } catch {
    messaging = null
  }
}

if (messaging) {
  messaging.onBackgroundMessage((payload) => {
    const hasNotificationPayload = Boolean(payload?.notification)
    const hasDataDisplayPayload = Boolean(payload?.data?.title || payload?.data?.body)

    // Avoid duplicate notifications when FCM already renders `notification` payloads.
    if (hasNotificationPayload && !hasDataDisplayPayload) {
      return
    }

    const title = payload?.data?.title ?? payload?.notification?.title ?? 'Codoc'
    const body = payload?.data?.body ?? payload?.notification?.body ?? ''
    const type = payload?.data?.type ?? 'GENERAL'

    const linkCode = payload?.data?.linkCode ?? null
    const linkParams = parseLinkParams(payload?.data?.linkParams)
    const linkUrl = resolveTargetLink({
      linkCode,
      linkParams,
      linkUrl: payload?.data?.linkUrl ?? null,
    })

    self.registration.showNotification(title, {
      body,
      tag: `codoc:${type}`,
      icon: NOTIFICATION_LOGO_PATH,
      badge: NOTIFICATION_LOGO_PATH,
      data: {
        linkCode,
        linkParams,
        linkUrl,
      },
    })
  })
}

self.addEventListener('notificationclick', (event) => {
  event.notification?.close()

  const notificationData = event.notification?.data ?? {}
  const linkCode = notificationData?.linkCode ?? null
  const linkParams = parseLinkParams(notificationData?.linkParams)
  const linkUrl = notificationData?.linkUrl ?? null

  const targetLink = resolveTargetLink({ linkCode, linkParams, linkUrl })

  let targetUrl = '/'

  try {
    targetUrl = new URL(targetLink, self.location.origin).toString()
  } catch {
    targetUrl = new URL('/', self.location.origin).toString()
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus()
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl)
      }

      return undefined
    }),
  )
})
