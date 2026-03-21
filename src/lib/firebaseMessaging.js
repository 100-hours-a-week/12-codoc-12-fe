import { getApps, initializeApp } from 'firebase/app'
import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging'

const FIREBASE_MESSAGING_SW_PATH = '/firebase-messaging-sw.js'
const NOTIFICATION_LOGO_PATH = '/notification-icon.png'
const LINK_CODE_PATHS = {
  HOME: '/',
  MY: '/my',
  LEADERBOARD: '/leaderboard',
  CHAT: '/chat',
  CUSTOM_PROBLEM: '/custom-problems',
}

const REQUIRED_ENV_MAP = {
  apiKey: 'VITE_FIREBASE_API_KEY',
  projectId: 'VITE_FIREBASE_PROJECT_ID',
  messagingSenderId: 'VITE_FIREBASE_MESSAGING_SENDER_ID',
  appId: 'VITE_FIREBASE_APP_ID',
  vapidKey: 'VITE_FIREBASE_VAPID_KEY',
}

const getEnv = (key) => {
  const value = import.meta.env[key]
  if (typeof value !== 'string') {
    return ''
  }
  return value.trim()
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

  if (linkCode === 'CUSTOM_PROBLEM') {
    const rawCustomProblemId = linkParams?.customProblemId
    if (rawCustomProblemId !== null && rawCustomProblemId !== undefined) {
      const customProblemId = String(rawCustomProblemId).trim()
      if (customProblemId) {
        return `/custom-problems/${encodeURIComponent(customProblemId)}`
      }
    }
    return '/custom-problems'
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

const getFirebaseMessagingConfig = () => ({
  apiKey: getEnv('VITE_FIREBASE_API_KEY'),
  authDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: getEnv('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: getEnv('VITE_FIREBASE_APP_ID'),
  vapidKey: getEnv('VITE_FIREBASE_VAPID_KEY'),
})

const getMissingRequiredEnvKeys = (config) =>
  Object.entries(REQUIRED_ENV_MAP)
    .filter(([configKey]) => !config[configKey])
    .map(([, envKey]) => envKey)

const resolveFirebaseApp = (config) => {
  const existingApps = getApps()

  if (existingApps.length > 0) {
    return existingApps[0]
  }

  const appConfig = {
    apiKey: config.apiKey,
    projectId: config.projectId,
    messagingSenderId: config.messagingSenderId,
    appId: config.appId,
  }

  if (config.authDomain) {
    appConfig.authDomain = config.authDomain
  }

  if (config.storageBucket) {
    appConfig.storageBucket = config.storageBucket
  }

  return initializeApp(appConfig)
}

const resolveServiceWorkerUrl = (config) => {
  const url = new URL(FIREBASE_MESSAGING_SW_PATH, window.location.origin)

  Object.entries({
    apiKey: config.apiKey,
    authDomain: config.authDomain,
    projectId: config.projectId,
    storageBucket: config.storageBucket,
    messagingSenderId: config.messagingSenderId,
    appId: config.appId,
  }).forEach(([key, value]) => {
    if (value) {
      url.searchParams.set(key, value)
    }
  })

  return url.toString()
}

let serviceWorkerRegistrationPromise = null

const registerMessagingServiceWorker = async (config) => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !window.isSecureContext) {
    return null
  }

  if (!serviceWorkerRegistrationPromise) {
    serviceWorkerRegistrationPromise = navigator.serviceWorker
      .register(resolveServiceWorkerUrl(config), { updateViaCache: 'none' })
      .then(async (registration) => {
        try {
          await registration.update()
        } catch {
          // Ignore explicit update failures and keep the active registration.
        }

        return registration
      })
      .catch((error) => {
        serviceWorkerRegistrationPromise = null
        throw error
      })
  }

  return serviceWorkerRegistrationPromise
}

const resolveMessagingServiceWorkerRegistration = async (config) => {
  let serviceWorkerRegistration = null

  try {
    serviceWorkerRegistration = await registerMessagingServiceWorker(config)
  } catch {
    throw new Error('SERVICE_WORKER_REGISTRATION_FAILED')
  }

  if (!serviceWorkerRegistration && typeof navigator !== 'undefined' && navigator.serviceWorker) {
    try {
      serviceWorkerRegistration = await navigator.serviceWorker.ready
    } catch {
      serviceWorkerRegistration = null
    }
  }

  if (!serviceWorkerRegistration) {
    throw new Error('SERVICE_WORKER_NOT_AVAILABLE')
  }

  if (!serviceWorkerRegistration.pushManager) {
    throw new Error('PUSH_MANAGER_UNAVAILABLE')
  }

  return serviceWorkerRegistration
}

const toDisplayNotificationPayload = (payload) => {
  const hasNotificationPayload = Boolean(payload?.notification)
  const hasDataDisplayPayload = Boolean(payload?.data?.title || payload?.data?.body)

  if (hasNotificationPayload && !hasDataDisplayPayload) {
    return null
  }

  const linkCode = payload?.data?.linkCode ?? null
  const linkParams = parseLinkParams(payload?.data?.linkParams)
  const linkUrl = resolveTargetLink({
    linkCode,
    linkParams,
    linkUrl: payload?.data?.linkUrl ?? null,
  })

  return {
    title: payload?.data?.title ?? payload?.notification?.title ?? 'Codoc',
    body: payload?.data?.body ?? payload?.notification?.body ?? '',
    type: payload?.data?.type ?? 'GENERAL',
    linkCode,
    linkParams,
    linkUrl,
  }
}

const showForegroundNotification = async (payload) => {
  if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
    return
  }

  if (getNotificationPermission() !== 'granted') {
    return
  }

  const notificationPayload = toDisplayNotificationPayload(payload)
  if (!notificationPayload) {
    return
  }

  const notificationOptions = {
    body: notificationPayload.body,
    tag: `codoc:${notificationPayload.type}`,
    icon: NOTIFICATION_LOGO_PATH,
    badge: NOTIFICATION_LOGO_PATH,
    data: {
      linkCode: notificationPayload.linkCode,
      linkParams: notificationPayload.linkParams,
      linkUrl: notificationPayload.linkUrl,
    },
  }

  try {
    const serviceWorkerRegistration = await resolveMessagingServiceWorkerRegistration(
      getFirebaseMessagingConfig(),
    )
    await serviceWorkerRegistration.showNotification(notificationPayload.title, notificationOptions)
    return
  } catch {
    // Fall through to window notification.
  }

  if (typeof window === 'undefined' || !('Notification' in window)) {
    return
  }

  const notification = new Notification(notificationPayload.title, notificationOptions)
  notification.onclick = () => {
    window.focus()

    try {
      const targetUrl = new URL(notificationPayload.linkUrl, window.location.origin).toString()
      window.location.assign(targetUrl)
    } catch {
      window.location.assign('/')
    }
  }
}

export const getFirebaseMessagingMissingConfigKeys = () =>
  getMissingRequiredEnvKeys(getFirebaseMessagingConfig())

export const isFirebaseMessagingConfigured = () =>
  getFirebaseMessagingMissingConfigKeys().length === 0

export const getNotificationPermission = () => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported'
  }

  return Notification.permission
}

export const requestNotificationPermission = async () => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported'
  }

  try {
    return await Notification.requestPermission()
  } catch {
    return 'denied'
  }
}

export const isWebPushSupported = async () => {
  if (typeof window === 'undefined') {
    return false
  }

  if (!window.isSecureContext) {
    return false
  }

  if (
    !('Notification' in window) ||
    !('serviceWorker' in navigator) ||
    !('PushManager' in window)
  ) {
    return false
  }

  try {
    return await isSupported()
  } catch {
    return false
  }
}

export const getWebPushToken = async () => {
  const config = getFirebaseMessagingConfig()
  const missingEnvKeys = getMissingRequiredEnvKeys(config)

  if (missingEnvKeys.length > 0) {
    throw new Error(`FCM_CONFIG_MISSING:${missingEnvKeys.join(',')}`)
  }

  if (getNotificationPermission() !== 'granted') {
    throw new Error('NOTIFICATION_PERMISSION_NOT_GRANTED')
  }

  if (!(await isWebPushSupported())) {
    throw new Error('WEB_PUSH_NOT_SUPPORTED')
  }

  const app = resolveFirebaseApp(config)
  const messaging = getMessaging(app)
  const serviceWorkerRegistration = await resolveMessagingServiceWorkerRegistration(config)

  try {
    const token = await getToken(messaging, {
      vapidKey: config.vapidKey,
      serviceWorkerRegistration,
    })

    if (!token) {
      throw new Error('FCM_TOKEN_EMPTY')
    }

    return token
  } catch {
    throw new Error('FCM_TOKEN_FETCH_FAILED')
  }
}

export const subscribeToForegroundMessages = async (listener) => {
  if (!isFirebaseMessagingConfigured()) {
    return () => {}
  }

  if (getNotificationPermission() !== 'granted') {
    return () => {}
  }

  if (!(await isWebPushSupported())) {
    return () => {}
  }

  const config = getFirebaseMessagingConfig()
  const app = resolveFirebaseApp(config)
  const messaging = getMessaging(app)

  return onMessage(messaging, async (payload) => {
    if (typeof listener === 'function') {
      await listener(payload)
    }

    await showForegroundNotification(payload)
  })
}
