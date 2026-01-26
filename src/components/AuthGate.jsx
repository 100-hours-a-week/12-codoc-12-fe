import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { getAccessToken, refreshAccessToken } from '@/lib/auth'

export default function AuthGate({ children }) {
  const [status, setStatus] = useState('checking')
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    let isMounted = true

    const ensureSession = async () => {
      if (getAccessToken()) {
        if (isMounted) {
          setStatus('ready')
        }
        return
      }

      try {
        await refreshAccessToken()
        if (isMounted) {
          setStatus('ready')
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
  }, [location.pathname, navigate, status])

  if (status !== 'ready') {
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
