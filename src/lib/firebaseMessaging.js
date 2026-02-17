import { getApps, initializeApp } from 'firebase/app'
import { getMessaging, getToken, isSupported } from 'firebase/messaging'

const FIREBASE_MESSAGING_SW_PATH = '/firebase-messaging-sw.js'

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
      .register(resolveServiceWorkerUrl(config))
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
