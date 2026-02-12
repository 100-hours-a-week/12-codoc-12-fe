import RateLimit from '@/pages/RateLimit'
import { useRateLimitStore } from '@/stores/useRateLimitStore'

export default function RateLimitGate({ children }) {
  const isRateLimited = useRateLimitStore((state) => state.isRateLimited)

  if (isRateLimited) {
    return <RateLimit />
  }

  return children
}
