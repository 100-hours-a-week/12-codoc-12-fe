const MINUTE_MS = 60 * 1000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

const toRelativeTimeLabel = (value) => {
  if (!value) {
    return ''
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const diffMs = Math.max(0, Date.now() - date.getTime())

  if (diffMs < MINUTE_MS) {
    return '방금'
  }

  if (diffMs < HOUR_MS) {
    return `${Math.floor(diffMs / MINUTE_MS)}분 전`
  }

  if (diffMs < DAY_MS) {
    return `${Math.floor(diffMs / HOUR_MS)}시간 전`
  }

  return `${Math.floor(diffMs / DAY_MS)}일 전`
}

const toJoinedChatRoomItem = (item = {}) => {
  const lastMessageAt = item.lastMessageAt ?? null

  return {
    roomId: item.roomId ?? null,
    title: item.title ?? '',
    participantsCount: Number(item.participantsCount ?? 0),
    unreadCount: Number(item.unreadCount ?? 0),
    lastMessagePreview: item.lastMessagePreview ?? '',
    lastMessageAt,
    lastMessageAtLabel: toRelativeTimeLabel(lastMessageAt),
  }
}

const toSearchChatRoomItem = (item = {}) => {
  const lastMessageAt = item.lastMessageAt ?? null

  return {
    roomId: item.roomId ?? null,
    title: item.title ?? '',
    hasPassword: Boolean(item.hasPassword),
    participantCount: Number(item.participantCount ?? 0),
    maxParticipants: Number(item.maxParticipants ?? 0),
    lastMessageAt,
    lastMessageAtLabel: toRelativeTimeLabel(lastMessageAt),
  }
}

const toCursorPagingResponse = (apiResponse, itemMapper) => {
  const data = apiResponse?.data ?? {}
  const items = Array.isArray(data.items) ? data.items : []

  return {
    items: items.map(itemMapper),
    nextCursor: data.nextCursor ?? null,
    hasNextPage: Boolean(data.hasNextPage),
  }
}

export const toJoinedChatRoomListResponse = (apiResponse) =>
  toCursorPagingResponse(apiResponse, toJoinedChatRoomItem)

export const toSearchChatRoomListResponse = (apiResponse) =>
  toCursorPagingResponse(apiResponse, toSearchChatRoomItem)
