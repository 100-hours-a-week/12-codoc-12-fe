const DEFAULT_PLATFORM = 'WEB'

export const toNotificationReadRequest = (notificationIds = []) => {
  const normalizedIds = Array.isArray(notificationIds)
    ? [...new Set(notificationIds)]
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0)
    : []

  return {
    notificationIds: normalizedIds,
  }
}

export const toNotificationDeviceRegisterRequest = (pushToken, platform = DEFAULT_PLATFORM) => ({
  platform,
  pushToken: String(pushToken ?? '').trim(),
})

export const toNotificationPreferenceUpdateRequest = (type, enabled) => ({
  type,
  enabled: Boolean(enabled),
})
