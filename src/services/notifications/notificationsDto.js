const NOTIFICATION_TYPE_LABELS = {
  ATTENDANCE: '연속 학습 알림',
  AI_RECOMMENDED_PROBLEM_ISSUED: 'AI 추천 문제 발급 알림',
  AI_ANALYSIS_REPORT_CREATED: 'AI 분석 레포트 생성 알림',
  LEADERBOARD_CLOSED: '리더보드 시즌 종료 알림',
}

const toNotificationTypeLabel = (type) => NOTIFICATION_TYPE_LABELS[type] ?? type ?? '알림'

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS
const MINUTE_MS = 60 * 1000

const toRelativeTimeLabel = (value) => {
  if (!value) {
    return ''
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const diffMs = Math.max(0, Date.now() - date.getTime())

  if (diffMs < HOUR_MS) {
    const minutes = Math.floor(diffMs / MINUTE_MS)
    if (minutes <= 0) {
      return '방금'
    }
    return `${minutes}분전`
  }

  if (diffMs < DAY_MS) {
    const hours = Math.floor(diffMs / HOUR_MS)
    return `${hours}시간전`
  }

  const days = Math.floor(diffMs / DAY_MS)
  return `${days}일전`
}

const normalizeLinkParams = (value) => {
  if (!value) {
    return {}
  }

  let candidate = value

  if (typeof candidate === 'string') {
    try {
      candidate = JSON.parse(candidate)
    } catch {
      return {}
    }
  }

  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return {}
  }

  const entries = Object.entries(candidate)
    .filter(([key]) => typeof key === 'string' && key.trim() !== '')
    .map(([key, itemValue]) => [key, itemValue == null ? '' : String(itemValue)])

  return Object.fromEntries(entries)
}

export const toNotificationItem = (item = {}) => {
  const createdAt = item.createdAt ?? item.created_at ?? null

  return {
    id: item.notificationId ?? null,
    type: item.type ?? null,
    typeLabel: toNotificationTypeLabel(item.type),
    title: item.title ?? '',
    body: item.body ?? '',
    linkCode: item.linkCode ?? item.link_code ?? null,
    linkParams: normalizeLinkParams(item.linkParams ?? item.link_params ?? null),
    linkUrl: item.linkUrl ?? item.link_url ?? null,
    createdAt,
    createdAtLabel: toRelativeTimeLabel(createdAt),
  }
}

export const toNotificationsResponse = (apiResponse) => {
  const data = apiResponse?.data ?? {}
  const notifications = Array.isArray(data.notifications) ? data.notifications : []

  return {
    notifications: notifications.map(toNotificationItem),
  }
}

export const toUnreadNotificationStatusResponse = (apiResponse) => {
  const data = apiResponse?.data ?? {}
  return {
    hasUnread: Boolean(data.hasUnread),
  }
}

export const toNotificationPreferenceItem = (item = {}) => ({
  type: item.type ?? null,
  typeLabel: toNotificationTypeLabel(item.type),
  enabled: Boolean(item.enabled),
})

export const toNotificationPreferencesResponse = (apiResponse) => {
  const data = apiResponse?.data ?? {}
  const preferences = Array.isArray(data.preferences) ? data.preferences : []

  return {
    preferences: preferences.map(toNotificationPreferenceItem),
  }
}
