import { api } from '@/lib/api'

export const requestNotifications = async () => {
  const response = await api.get('/api/notifications')
  return response.data
}

export const requestUnreadNotificationStatus = async () => {
  const response = await api.get('/api/notifications/unread-status')
  return response.data
}

export const requestMarkNotificationsAsRead = async (payload) => {
  const response = await api.patch('/api/notifications/read-status', payload)
  return response.data
}

export const requestNotificationDeviceRegister = async (payload) => {
  const response = await api.put('/api/notification-devices', payload)
  return response.data
}

export const requestNotificationDeviceDeactivate = async () => {
  const response = await api.delete('/api/notification-devices')
  return response.data
}

export const requestNotificationPreferences = async () => {
  const response = await api.get('/api/notification-preferences')
  return response.data
}

export const requestNotificationPreferenceUpdate = async (payload) => {
  const response = await api.patch('/api/notification-preferences', payload)
  return response.data
}
