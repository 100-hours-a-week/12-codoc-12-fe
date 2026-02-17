import { useEffect } from 'react'

import { useNotificationStore } from '@/stores/useNotificationStore'

export const useNotificationBootstrap = () => {
  const refreshUnreadStatus = useNotificationStore((state) => state.refreshUnreadStatus)

  useEffect(() => {
    refreshUnreadStatus()
  }, [refreshUnreadStatus])

  useEffect(() => {
    const handleFocus = () => {
      refreshUnreadStatus()
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshUnreadStatus()
      }
    }

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [refreshUnreadStatus])
}
