import { useEffect, useRef } from 'react'

import { getAccessTokenPayload } from '@/lib/auth'
import {
  createChatStompConnection,
  toUserChatRoomsTopic,
  toUserChatUnreadStatusTopic,
} from '@/services/chat/chatRealtime'
import { useChatRealtimeStore } from '@/stores/useChatRealtimeStore'

const toCurrentUserId = () => {
  const payload = getAccessTokenPayload()
  const parsed = Number(payload?.userId ?? payload?.sub)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null
  }
  return parsed
}

export const useChatRealtimeBootstrap = () => {
  const applyRoomUpdate = useChatRealtimeStore((state) => state.applyRoomUpdate)
  const applyUnreadStatus = useChatRealtimeStore((state) => state.applyUnreadStatus)
  const refreshUnreadChatStatus = useChatRealtimeStore((state) => state.refreshUnreadChatStatus)

  const connectionRef = useRef(null)
  const roomSubscriptionRef = useRef(null)
  const unreadSubscriptionRef = useRef(null)
  const connectionTokenRef = useRef(0)

  useEffect(() => {
    void refreshUnreadChatStatus()

    const handleFocus = () => {
      void refreshUnreadChatStatus()
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void refreshUnreadChatStatus()
      }
    }

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [refreshUnreadChatStatus])

  useEffect(() => {
    const userId = toCurrentUserId()
    if (userId == null) {
      return undefined
    }

    const connectionToken = connectionTokenRef.current + 1
    connectionTokenRef.current = connectionToken

    const connection = createChatStompConnection({
      onConnect: () => {
        if (connectionTokenRef.current !== connectionToken) {
          return
        }

        roomSubscriptionRef.current?.unsubscribe()
        roomSubscriptionRef.current = connectionRef.current?.subscribe(
          toUserChatRoomsTopic(userId),
          (payload) => {
            if (!payload || typeof payload !== 'object') {
              return
            }
            applyRoomUpdate(payload)
          },
        )

        unreadSubscriptionRef.current?.unsubscribe()
        unreadSubscriptionRef.current = connectionRef.current?.subscribe(
          toUserChatUnreadStatusTopic(userId),
          (payload) => {
            if (!payload || typeof payload !== 'object') {
              return
            }
            applyUnreadStatus(payload)
          },
        )
      },
    })

    connectionRef.current = connection
    connection.activate()

    return () => {
      connectionTokenRef.current += 1
      roomSubscriptionRef.current?.unsubscribe()
      roomSubscriptionRef.current = null
      unreadSubscriptionRef.current?.unsubscribe()
      unreadSubscriptionRef.current = null
      connectionRef.current = null
      connection.deactivate()
    }
  }, [applyRoomUpdate, applyUnreadStatus, refreshUnreadChatStatus])
}
