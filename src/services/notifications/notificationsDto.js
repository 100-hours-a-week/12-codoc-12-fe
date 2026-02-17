const NOTIFICATION_TYPE_LABELS = {
  ATTENDANCE: '연속 학습 알림',
  AI_RECOMMENDED_PROBLEM_ISSUED: 'AI 추천 문제 발급 알림',
  AI_ANALYSIS_REPORT_CREATED: 'AI 분석 레포트 생성 알림',
  LEADERBOARD_CLOSED: '리더보드 시즌 종료 알림',
}

const toNotificationTypeLabel = (type) => NOTIFICATION_TYPE_LABELS[type] ?? type ?? '알림'

const toDateTimeLabel = (value) => {
  if (!value) {
    return ''
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return new Intl.DateTimeFormat('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Seoul',
  }).format(date)
}

export const toNotificationItem = (item = {}) => ({
  id: item.notificationId ?? null,
  type: item.type ?? null,
  typeLabel: toNotificationTypeLabel(item.type),
  title: item.title ?? '',
  body: item.body ?? '',
  linkUrl: item.linkUrl ?? null,
  createdAt: item.createdAt ?? null,
  createdAtLabel: toDateTimeLabel(item.createdAt),
})

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
