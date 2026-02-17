import { create } from 'zustand'

import { getUnreadNotificationStatus } from '@/services/notifications/notificationsService'

export const useNotificationStore = create((set, get) => ({
  hasUnread: false,
  isUnreadStatusLoaded: false,
  isUnreadStatusLoading: false,
  setUnreadStatus: (hasUnread) =>
    set({
      hasUnread: Boolean(hasUnread),
      isUnreadStatusLoaded: true,
    }),
  refreshUnreadStatus: async () => {
    if (get().isUnreadStatusLoading) {
      return
    }

    set({ isUnreadStatusLoading: true })

    try {
      const { hasUnread } = await getUnreadNotificationStatus()
      set({
        hasUnread: Boolean(hasUnread),
        isUnreadStatusLoaded: true,
      })
    } catch {
      set({ isUnreadStatusLoaded: true })
    } finally {
      set({ isUnreadStatusLoading: false })
    }
  },
}))
