const STATUS_MAP = {
  ACCEPTED: 'ACCEPTED',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  '': '',
}

export const normalizeChatbotStatus = (status) => STATUS_MAP[status ?? ''] ?? ''

export const toChatbotMessageResponse = (apiResponse) => {
  const data = apiResponse?.data ?? {}

  return {
    conversationId: data.conversationId ?? null,
    status: normalizeChatbotStatus(data.status),
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
