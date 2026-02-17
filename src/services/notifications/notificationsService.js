import {
  requestMarkNotificationsAsRead,
  requestNotificationDeviceDeactivate,
  requestNotificationDeviceRegister,
  requestNotificationPreferenceUpdate,
  requestNotificationPreferences,
  requestNotifications,
  requestUnreadNotificationStatus,
} from './notificationsApi'
import {
  toNotificationPreferencesResponse,
  toNotificationsResponse,
  toUnreadNotificationStatusResponse,
} from './notificationsDto'
import {
  toNotificationDeviceRegisterRequest,
  toNotificationPreferenceUpdateRequest,
  toNotificationReadRequest,
} from './notificationsRequestDto'

export const getNotifications = async () => {
  const response = await requestNotifications()
  return toNotificationsResponse(response)
}

export const getUnreadNotificationStatus = async () => {
  const response = await requestUnreadNotificationStatus()
  return toUnreadNotificationStatusResponse(response)
}

export const markNotificationsAsRead = async (notificationIds = []) => {
  const payload = toNotificationReadRequest(notificationIds)

  if (payload.notificationIds.length === 0) {
    return
  }

  await requestMarkNotificationsAsRead(payload)
}

export const registerNotificationDevice = async (pushToken, platform = 'WEB') => {
  const payload = toNotificationDeviceRegisterRequest(pushToken, platform)

  if (!payload.pushToken) {
    return
  }

  await requestNotificationDeviceRegister(payload)
}

export const deactivateNotificationDevice = async () => {
  await requestNotificationDeviceDeactivate()
}

export const getNotificationPreferences = async () => {
  const response = await requestNotificationPreferences()
  return toNotificationPreferencesResponse(response)
}

export const updateNotificationPreference = async (type, enabled) => {
  const payload = toNotificationPreferenceUpdateRequest(type, enabled)
  await requestNotificationPreferenceUpdate(payload)
}
