import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { getAccessToken, getAccessTokenPayload, getAccessTokenStatus, refreshAccessToken } from '@/lib/auth'
import { setUserId } from '@/lib/ga4'

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
        if (isMounted) {
          setStatus(resolveStatus(existingToken) ?? 'unauthenticated')
        }
        return
      }

      try {
        const token = await refreshAccessToken()
        applyUserId(token)
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
