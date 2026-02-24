const STATUS_MAP = {
  ACCEPTED: 'ACCEPTED',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CHATBOT_STREAM_EVENT_FAILED: 'FAILED',
  '': '',
}

export const normalizeChatbotStatus = (status) => {
  const normalizedKey =
    typeof status === 'string' ? status.trim().toUpperCase() : String(status ?? '')
  return STATUS_MAP[normalizedKey] ?? ''
}

export const toChatbotMessageResponse = (apiResponse) => {
  const data = apiResponse?.data ?? {}

  return {
    conversationId: data.conversationId ?? null,
    status: normalizeChatbotStatus(data.status),
  }
}

export const toChatbotConversationItem = (item = {}) => ({
  conversationId: item.conversationId ?? item.id ?? null,
  userMessage: item.userMessage ?? item.user_message ?? '',
  aiMessage: item.aiMessage ?? item.ai_message ?? '',
})

export const toChatbotConversationListResponse = (apiResponse) => {
  const data = apiResponse?.data ?? {}
  const items = Array.isArray(data.items) ? data.items : []

  return {
    items: items.map(toChatbotConversationItem),
    nextCursor: data.nextCursor ?? data.next_cursor ?? null,
    hasNextPage: Boolean(data.hasNextPage ?? data.has_next_page),
  }
}

export const parseChatbotStreamEvent = (data) => {
  if (!data) {
    return null
  }

  try {
    return JSON.parse(data)
  } catch {
    return null
  }
}
