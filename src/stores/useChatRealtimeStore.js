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

const toNormalizedUnreadStatus = (payload = {}) => {
  const totalUnreadChatCount = Number(payload.totalUnreadCount)
  if (!Number.isFinite(totalUnreadChatCount) || totalUnreadChatCount < 0) {
    return null
  }

  return {
    totalUnreadChatCount,
  }
}

export const useChatRealtimeStore = create((set, get) => ({
  hasUnreadChat: false,
  totalUnreadChatCount: 0,
  isUnreadChatRefreshing: false,
  roomUpdatesById: {},
  roomUpdateVersion: 0,
  setHasUnreadChat: (hasUnreadChat) =>
    set((state) => ({
      hasUnreadChat: Boolean(hasUnreadChat),
      totalUnreadChatCount: hasUnreadChat ? Math.max(1, state.totalUnreadChatCount) : 0,
    })),
  refreshUnreadChatStatus: async () => {
    if (get().isUnreadChatRefreshing) {
      return
    }

    set({ isUnreadChatRefreshing: true })

    try {
      const { totalUnreadCount } = await getChatUnreadStatus()
      set({
        hasUnreadChat: Number.isFinite(totalUnreadCount) && totalUnreadCount > 0,
        totalUnreadChatCount:
          Number.isFinite(totalUnreadCount) && totalUnreadCount > 0 ? totalUnreadCount : 0,
      })
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
  applyUnreadStatus: (payload) => {
    const unreadStatus = toNormalizedUnreadStatus(payload)
    if (!unreadStatus) {
      return
    }

    set({
      totalUnreadChatCount: unreadStatus.totalUnreadChatCount,
      hasUnreadChat: unreadStatus.totalUnreadChatCount > 0,
    })
  },
}))
