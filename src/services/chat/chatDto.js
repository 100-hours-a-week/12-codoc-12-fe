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

const pad2 = (value) => String(value).padStart(2, '0')

const toMessageDateTimeLabel = (value) => {
  if (!value) {
    return ''
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return `${date.getMonth() + 1}/${date.getDate()} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`
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

export const toChatMessageItem = (item = {}) => {
  const createdAt = item.createdAt ?? null
  const senderId = Number(item.senderId)
  const rawSenderNickname =
    typeof item.senderNickname === 'string'
      ? item.senderNickname
      : typeof item.senderName === 'string'
        ? item.senderName
        : ''
  const senderNickname = rawSenderNickname.trim()

  return {
    messageId: item.messageId ?? null,
    senderId: Number.isInteger(senderId) ? senderId : null,
    senderNickname,
    type: String(item.type ?? 'TEXT').toUpperCase(),
    content: item.content ?? '',
    createdAt,
    createdAtLabel: toMessageDateTimeLabel(createdAt),
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

export const toChatMessageListResponse = (apiResponse) =>
  toCursorPagingResponse(apiResponse, toChatMessageItem)
