import { BellOff, ChevronRight, Settings } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import StatusMessage from '@/components/StatusMessage'
import {
  getNotifications,
  markNotificationsAsRead,
} from '@/services/notifications/notificationsService'
import { useNotificationStore } from '@/stores/useNotificationStore'

const LINK_CODE_PATHS = {
  HOME: '/',
  MY: '/my',
  LEADERBOARD: '/leaderboard',
  CHAT: '/chat',
  CUSTOM_PROBLEM: '/custom-problems',
}

const resolveLegacyLink = (linkUrl) => {
  if (!linkUrl) {
    return null
  }

  if (/^https?:\/\//i.test(linkUrl)) {
    return linkUrl
  }

  if (!linkUrl.startsWith('/')) {
    return `/${linkUrl}`
  }

  return linkUrl
}

const resolvePathByLinkCode = (linkCode, linkParams = {}) => {
  if (!linkCode) {
    return null
  }

  if (linkCode === 'PROBLEM_DETAIL') {
    const rawProblemId = linkParams?.problemId

    if (rawProblemId === null || rawProblemId === undefined) {
      return '/problems'
    }

    const problemId = String(rawProblemId).trim()

    if (!problemId) {
      return '/problems'
    }

    return `/problems/${encodeURIComponent(problemId)}`
  }

  if (linkCode === 'CHAT') {
    const rawRoomId = linkParams?.roomId
    if (rawRoomId !== null && rawRoomId !== undefined) {
      const roomId = String(rawRoomId).trim()
      if (roomId) {
        return `/chat/${encodeURIComponent(roomId)}`
      }
    }
    return '/chat'
  }

  return LINK_CODE_PATHS[linkCode] ?? null
}

const resolveNotificationLink = (notification) => {
  if (!notification || typeof notification !== 'object') {
    return null
  }

  return (
    resolvePathByLinkCode(notification.linkCode, notification.linkParams) ??
    resolveLegacyLink(notification.linkUrl)
  )
}

const openNotificationLink = (navigate, notification) => {
  const resolvedLink = resolveNotificationLink(notification)

  if (!resolvedLink) {
    return
  }

  if (/^https?:\/\//i.test(resolvedLink)) {
    window.location.assign(resolvedLink)
    return
  }

  navigate(resolvedLink)
}

export default function Notifications() {
  const navigate = useNavigate()
  const setUnreadStatus = useNotificationStore((state) => state.setUnreadStatus)
  const refreshUnreadStatus = useNotificationStore((state) => state.refreshUnreadStatus)

  const [notifications, setNotifications] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const fetchNotifications = useCallback(async () => {
    setIsLoading(true)
    setLoadError('')

    try {
      const { notifications: items } = await getNotifications()
      setNotifications(items)
    } catch {
      setLoadError('알림 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.')
      setNotifications([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  useEffect(() => {
    if (loadError) {
      return
    }

    if (!Array.isArray(notifications) || notifications.length === 0) {
      setUnreadStatus(false)
      return
    }

    const ids = notifications.map((notification) => notification.id).filter(Boolean)

    if (ids.length === 0) {
      setUnreadStatus(false)
      return
    }

    let active = true

    const syncReadStatus = async () => {
      try {
        await markNotificationsAsRead(ids)
        if (active) {
          setUnreadStatus(false)
        }
      } catch {
        if (active) {
          refreshUnreadStatus()
        }
      }
    }

    syncReadStatus()

    return () => {
      active = false
    }
  }, [loadError, notifications, refreshUnreadStatus, setUnreadStatus])

  const isEmptyState = !isLoading && notifications.length === 0

  return (
    <section
      className={isEmptyState ? 'flex min-h-[calc(100dvh-20rem)] flex-col gap-4' : 'space-y-4'}
    >
      <div className="flex min-h-9 items-center justify-between">
        <h2 className="text-lg font-semibold">알림</h2>
        <button
          aria-label="알림 설정"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-foreground transition hover:text-info"
          onClick={() => navigate('/notifications/settings')}
          type="button"
        >
          <Settings className="h-6 w-6" />
        </button>
      </div>

      {loadError ? <StatusMessage tone="error">{loadError}</StatusMessage> : null}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={`notification-skeleton-${index}`}
              className="h-24 animate-pulse rounded-2xl bg-muted/60"
            />
          ))}
        </div>
      ) : null}

      {!isLoading && notifications.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <BellOff className="h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-sm font-semibold">최근 1주일 알림이 없습니다.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            새로운 알림이 오면 여기에 표시됩니다.
          </p>
        </div>
      ) : null}

      {!isLoading && notifications.length > 0 ? (
        <ul className="space-y-2">
          {notifications.map((notification) => {
            return (
              <li key={notification.id ?? `${notification.type}-${notification.createdAt}`}>
                <button
                  className="w-full rounded-2xl border border-border bg-card p-4 text-left shadow-[0_6px_16px_rgba(15,23,42,0.05)] transition hover:bg-muted/40"
                  onClick={() => openNotificationLink(navigate, notification)}
                  type="button"
                >
                  <div className="min-w-0 flex-1 flex flex-col gap-3">
                    <p className="text-sm font-semibold leading-5">{notification.title}</p>
                    {notification.body ? (
                      <p className="text-sm leading-5 text-muted-foreground">{notification.body}</p>
                    ) : null}
                    <p className="text-[11px] font-medium text-muted-foreground">
                      {notification.createdAtLabel}
                    </p>
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </section>
  )
}
