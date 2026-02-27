import { useSessionCountdown } from '@/hooks/useSessionCountdown'

export default function SessionTimer({ expiresAt, className = '' }) {
  const { formatted, isExpired } = useSessionCountdown(expiresAt)

  if (!formatted) {
    return null
  }

  return (
    <div
      className={`rounded-full border border-info/20 bg-info/10 px-3 py-1 text-xs font-semibold text-info ${
        className ?? ''
      }`}
    >
      {isExpired ? '세션 만료' : `남은 시간 ${formatted}`}
    </div>
  )
}
