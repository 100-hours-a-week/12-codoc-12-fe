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
