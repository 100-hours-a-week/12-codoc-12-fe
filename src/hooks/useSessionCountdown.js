import { useEffect, useMemo, useState } from 'react'

const getTimestamp = (expiresAt) => {
  if (!expiresAt) {
    return null
  }
  const timestamp = Date.parse(expiresAt)
  return Number.isNaN(timestamp) ? null : timestamp
}

const getRemainingMs = (expiresAt, now) => {
  const target = getTimestamp(expiresAt)
  if (!target) {
    return null
  }
  const nowTimestamp = Number.isFinite(now) ? now : Date.now()
  return Math.max(0, target - nowTimestamp)
}

const formatTime = (timeLeftMs) => {
  if (timeLeftMs === null) {
    return null
  }
  const totalSeconds = Math.max(0, Math.floor(timeLeftMs / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export const useSessionCountdown = (expiresAt) => {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const target = getTimestamp(expiresAt)
    if (!target) {
      return
    }

    const intervalId = window.setInterval(() => {
      setNow(Date.now())
    }, 1000)
    return () => window.clearInterval(intervalId)
  }, [expiresAt])

  const timeLeftMs = useMemo(() => getRemainingMs(expiresAt, now) ?? null, [expiresAt, now])
  const formatted = useMemo(() => formatTime(timeLeftMs), [timeLeftMs])
  const isExpired = timeLeftMs !== null && timeLeftMs <= 0

  return { timeLeftMs, formatted, isExpired }
}
