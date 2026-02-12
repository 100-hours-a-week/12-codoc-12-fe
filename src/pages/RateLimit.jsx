import { useNavigate } from 'react-router-dom'
import { Clock } from 'lucide-react'

import { Button } from '@/components/Button'
import { useRateLimitStore } from '@/stores/useRateLimitStore'

export default function RateLimit() {
  const navigate = useNavigate()
  const clearRateLimit = useRateLimitStore((state) => state.clearRateLimit)

  const handleRetry = () => {
    clearRateLimit()
    navigate(0)
  }

  return (
    <div className="min-h-screen bg-muted/40 text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col items-center justify-center bg-background px-4 py-12 text-center">
        <div className="flex w-full flex-col items-center gap-10">
          <div className="flex w-full flex-col items-center gap-5">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <Clock className="h-7 w-7 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight">요청이 너무 많아요</h1>
              <h3 className="text-md text-muted-foreground">잠시 후 다시 시도해주세요</h3>
            </div>
          </div>
          <div className="flex w-full flex-col gap-3">
            <Button className="h-10 w-[358px] text-base" onClick={handleRetry}>
              다시 시도
            </Button>
            <Button
              className="h-10 w-[358px] text-base bg-muted text-muted-foreground hover:bg-muted"
              onClick={() => {
                clearRateLimit()
                navigate('/')
              }}
              variant="secondary"
            >
              홈으로 돌아가기
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
