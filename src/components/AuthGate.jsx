import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import {
  getAccessToken,
  getAccessTokenPayload,
  getAccessTokenStatus,
  refreshAccessToken,
} from '@/lib/auth'
import {
  getNotificationPermission,
  getWebPushToken,
  isFirebaseMessagingConfigured,
  requestNotificationPermission,
} from '@/lib/firebaseMessaging'
import { setUserId } from '@/lib/ga4'
import { registerNotificationDevice } from '@/services/notifications/notificationsService'

let syncPushDevicePromise = null
let syncedPushToken = ''

const resolveStatus = (token) => {
  const tokenStatus = getAccessTokenStatus(token)
  if (tokenStatus === 'ONBOARDING') {
    return 'onboarding'
  }
  if (tokenStatus === 'ACTIVE') {
    return 'ready'
  }
  return null
}

export default function AuthGate({ children }) {
  const [status, setStatus] = useState('checking')
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    let isMounted = true
    const syncPushDevice = async () => {
      if (syncPushDevicePromise) {
        await syncPushDevicePromise
        return
      }

      if (!isFirebaseMessagingConfigured()) {
        return
      }

      let permission = getNotificationPermission()
      if (permission !== 'granted') {
        permission = await requestNotificationPermission()
      }

      if (permission !== 'granted') {
        return
      }

      syncPushDevicePromise = (async () => {
        const pushToken = await getWebPushToken()

        if (!pushToken || pushToken === syncedPushToken) {
          return
        }

        await registerNotificationDevice(pushToken, 'WEB')
        syncedPushToken = pushToken
      })()

      try {
        await syncPushDevicePromise
      } catch {
        // Best-effort sync only.
      } finally {
        syncPushDevicePromise = null
      }
    }

    const applyUserId = (token) => {
      const payload = getAccessTokenPayload(token)
      const userId = payload?.userId ?? payload?.sub
      if (userId) {
        setUserId(userId)
      }
    }

    const ensureSession = async () => {
      const existingToken = getAccessToken()
      if (existingToken) {
        applyUserId(existingToken)
        void syncPushDevice()
        if (isMounted) {
          setStatus(resolveStatus(existingToken) ?? 'unauthenticated')
        }
        return
      }

      try {
        const token = await refreshAccessToken()
        applyUserId(token)
        void syncPushDevice()
        if (isMounted) {
          setStatus(resolveStatus(token) ?? 'unauthenticated')
        }
      } catch {
        if (isMounted) {
          setStatus('unauthenticated')
        }
      }
    }

    ensureSession()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (status === 'unauthenticated') {
      navigate('/login', { replace: true, state: { from: location.pathname } })
    }
    if (status === 'onboarding' && location.pathname !== '/onboarding') {
      navigate('/onboarding', { replace: true })
    }
    if (status === 'ready' && location.pathname === '/onboarding') {
      navigate('/', { replace: true })
    }
  }, [location.pathname, navigate, status])

  if (status === 'checking') {
    return (
      <div className="min-h-screen bg-muted/40 text-foreground">
        <div className="mx-auto flex min-h-screen w-full max-w-[430px] items-center justify-center bg-background px-6 text-sm text-muted-foreground">
          로그인 상태를 확인하는 중입니다.
        </div>
      </div>
    )
  }

  return children
}
