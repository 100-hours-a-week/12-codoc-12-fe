import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import StatusMessage from '@/components/StatusMessage'
import {
  getAccessToken,
  getAccessTokenPayload,
  getAccessTokenStatus,
  refreshAccessToken,
} from '@/lib/auth'
import { setUserId } from '@/lib/ga4'

const fallbackMessage = '문제를 읽는 힘\n코독에서 탄탄하게 키워보세요'

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
  const [isHeroImageMissing, setIsHeroImageMissing] = useState(false)

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
    const applyUserId = (token) => {
      const payload = getAccessTokenPayload(token)
      const userId = payload?.userId ?? payload?.sub
      if (userId) {
        setUserId(userId)
      }
    }

    const redirectWithStatus = (token) => {
      const status = getAccessTokenStatus(token)
      if (status === 'ONBOARDING') {
        applyUserId(token)
        navigate('/onboarding', { replace: true })
        return true
      }
      if (status === 'ACTIVE') {
        applyUserId(token)
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
    <div className="min-h-screen bg-white text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col px-7 pb-9 pt-16 text-center">
        <div className="space-y-3">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-[#94a3b8]">
            코딩테스트 문해력 향상 서비스
          </p>
          <h1 className="text-[44px] font-semibold leading-none tracking-[-0.03em] text-[#111827]">
            CodoC
          </h1>
          <p className="whitespace-pre-line text-[15px] font-medium leading-relaxed text-[#64748b]">
            {welcomeMessage}
          </p>
        </div>

        <div className="mt-11 flex items-center justify-center">
          {!isHeroImageMissing ? (
            <img
              alt="코독 로그인 이미지"
              className="h-[280px] w-[280px] max-w-full object-contain"
              src="/images/login_codoc.png"
              onError={() => setIsHeroImageMissing(true)}
            />
          ) : (
            <div className="flex h-[170px] w-[170px] items-center justify-center rounded-full bg-[#eef2f7] text-lg font-semibold text-[#44526d]">
              CodoC
            </div>
          )}
        </div>

        <div className="mt-8 space-y-3">
          <a
            className="block w-full rounded-2xl border border-black/10 bg-[#FEE500] px-4 py-3.5 text-sm font-semibold text-[#191600] transition hover:brightness-[0.98]"
            href={loginUrl}
          >
            카카오톡으로 시작하기
          </a>
          <p className="text-[12px] text-[#94a3b8]">카카오 계정으로 빠르게 시작할 수 있어요.</p>
          {errorCode ? (
            <StatusMessage tone="error">로그인에 실패했습니다. ({errorCode})</StatusMessage>
          ) : null}
        </div>
      </div>
    </div>
  )
}
