const NOTIFICATION_MASTER_ENABLED_KEY = 'notifications:masterEnabled'
const MASTER_ENABLED_DEFAULT = true

export const getNotificationMasterEnabled = () => {
  if (typeof window === 'undefined') {
    return MASTER_ENABLED_DEFAULT
  }

  const value = window.localStorage.getItem(NOTIFICATION_MASTER_ENABLED_KEY)

  if (value === null) {
    return MASTER_ENABLED_DEFAULT
  }

  return value === '1'
}

export const setNotificationMasterEnabled = (enabled) => {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(NOTIFICATION_MASTER_ENABLED_KEY, enabled ? '1' : '0')
}
