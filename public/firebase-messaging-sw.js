/* global importScripts, firebase */

importScripts('https://www.gstatic.com/firebasejs/11.0.2/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/11.0.2/firebase-messaging-compat.js')

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
    const title = payload?.notification?.title ?? 'Codoc'
    const body = payload?.notification?.body ?? ''
    const linkUrl = payload?.data?.linkUrl ?? '/'
    const type = payload?.data?.type ?? 'GENERAL'

    self.registration.showNotification(title, {
      body,
      tag: `codoc:${type}`,
      data: {
        linkUrl,
      },
    })
  })
}

self.addEventListener('notificationclick', (event) => {
  event.notification?.close()

  const linkValue = event.notification?.data?.linkUrl ?? '/'
  let targetUrl = '/'

  try {
    targetUrl = new URL(linkValue, self.location.origin).toString()
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
