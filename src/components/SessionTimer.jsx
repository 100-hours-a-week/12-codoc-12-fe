import { Clock } from 'lucide-react'

import { useSessionCountdown } from '@/hooks/useSessionCountdown'

export default function SessionTimer({ expiresAt, className = '' }) {
  const { formatted, isExpired } = useSessionCountdown(expiresAt)

  if (!formatted) {
    return null
  }

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full border border-info/40 bg-background/90 px-3 py-1 text-xs font-semibold text-foreground shadow-sm backdrop-blur ${
        className ?? ''
      }`}
    >
      <Clock className="h-3.5 w-3.5" />
      <span>{isExpired ? '00:00' : formatted}</span>
    </div>
  )
}
