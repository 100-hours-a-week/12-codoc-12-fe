import { create } from 'zustand'

import { getChatUnreadStatus } from '@/services/chat/chatService'

const toRoomId = (value) => {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null
  }
  return parsed
}

const toNormalizedRoomUpdate = (payload = {}) => {
  const roomId = toRoomId(payload.roomId)
  if (roomId == null) {
    return null
  }

  const lastMessagePreview =
    typeof payload.lastMessagePreview === 'string' ? payload.lastMessagePreview : ''
  const lastMessageAt = payload.lastMessageAt ?? null

  return {
    roomId,
    lastMessagePreview,
    lastMessageAt,
  }
}

export const useChatRealtimeStore = create((set, get) => ({
  hasUnreadChat: false,
  isUnreadChatRefreshing: false,
  roomUpdatesById: {},
  roomUpdateVersion: 0,
  setHasUnreadChat: (hasUnreadChat) => set({ hasUnreadChat: Boolean(hasUnreadChat) }),
  refreshUnreadChatStatus: async () => {
    if (get().isUnreadChatRefreshing) {
      return
    }

    set({ isUnreadChatRefreshing: true })

    try {
      const { hasUnread } = await getChatUnreadStatus()
      set({ hasUnreadChat: Boolean(hasUnread) })
    } catch {
      // Keep previous state when refresh fails.
    } finally {
      set({ isUnreadChatRefreshing: false })
    }
  },
  applyRoomUpdate: (payload) => {
    const update = toNormalizedRoomUpdate(payload)
    if (!update) {
      return
    }

    set((state) => ({
      hasUnreadChat: true,
      roomUpdatesById: {
        ...state.roomUpdatesById,
        [update.roomId]: update,
      },
      roomUpdateVersion: state.roomUpdateVersion + 1,
    }))
  },
}))
