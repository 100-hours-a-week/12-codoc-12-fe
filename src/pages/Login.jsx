import { useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { getAccessToken, getAccessTokenStatus, refreshAccessToken } from '@/lib/auth'

const fallbackMessage = '서비스 코독에 오신걸 환영 합니다'

const errorMessages = {
  KAKAO_CANCEL: '카카오 로그인을 취소했어요. 다시 시도해주세요.',
  AUTH_INVALID_REQUEST: '로그인 요청이 올바르지 않습니다.',
  AUTH_STATE_MISMATCH: '로그인 상태가 만료되었습니다. 다시 시도해주세요.',
  USER_FORBIDDEN: '접근이 제한된 계정입니다.',
  RATE_LIMITED: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
  KAKAO_API_ERROR: '카카오 인증 중 문제가 발생했습니다.',
  INTERNAL_SERVER_ERROR: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
}

export default function Login() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const errorCode = searchParams.get('error')

  const welcomeMessage = useMemo(() => {
    if (!errorCode) {
      return fallbackMessage
    }
    return errorMessages[errorCode] ?? '로그인에 실패했습니다. 다시 시도해주세요.'
  }, [errorCode])

  const loginUrl = useMemo(() => {
    const baseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')
    return `${baseUrl}/api/auth/kakao/authorize`
  }, [])

  useEffect(() => {
    const redirectWithStatus = (token) => {
      const status = getAccessTokenStatus(token)
      if (status === 'ONBOARDING') {
        navigate('/onboarding', { replace: true })
        return true
      }
      if (status === 'ACTIVE') {
        navigate('/', { replace: true })
        return true
      }
      return false
    }

    const existingToken = getAccessToken()
    if (existingToken && redirectWithStatus(existingToken)) {
      return
    }

    const tryRefresh = async () => {
      try {
        const token = await refreshAccessToken()
        if (!redirectWithStatus(token)) {
          navigate('/', { replace: true })
        }
      } catch {
        // Stay on login screen when refresh fails.
      }
    }

    tryRefresh()
  }, [navigate])

  return (
    <div className="min-h-screen bg-muted/40 text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col items-center justify-center gap-6 bg-background px-6 py-12 text-center">
        <div className="space-y-3">
          <h1 className="text-2xl font-semibold tracking-tight">CodoↃ</h1>
          <p className="text-sm text-muted-foreground">{welcomeMessage}</p>
        </div>
        <a
          className="w-full rounded-xl border border-foreground/10 bg-[#FEE500] px-4 py-3 text-sm font-semibold text-[#191600]"
          href={loginUrl}
        >
          카카오톡으로 시작하기
        </a>
        {errorCode ? (
          <p className="text-xs text-red-500">로그인에 실패했습니다. ({errorCode})</p>
        ) : null}
      </div>
    </div>
  )
}
