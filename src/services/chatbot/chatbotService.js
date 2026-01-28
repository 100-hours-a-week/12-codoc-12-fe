import { requestChatbotMessage } from './chatbotApi'
import { parseChatbotStreamEvent, toChatbotMessageResponse } from './chatbotDto'
import { toChatbotMessageRequest } from './chatbotRequestDto'

export const sendChatbotMessage = async (payload = {}) => {
  const response = await requestChatbotMessage(toChatbotMessageRequest(payload))
  return toChatbotMessageResponse(response)
}

export const createChatbotStream = (conversationId, handlers = {}) => {
  const { onMessage, onFinal, onError, onStatus } = handlers
  const baseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')
  const url = `${baseUrl}/api/chatbot/messages/${conversationId}/stream`
  const source = new EventSource(url, { withCredentials: true })

  source.onmessage = (event) => {
    if (event?.data) {
      onMessage?.(event.data)
    }
  }

  source.addEventListener('final', (event) => {
    const parsed = parseChatbotStreamEvent(event?.data)
    onFinal?.(parsed, event?.data)

    const status = parsed?.result?.status ?? parsed?.status
    if (status) {
      onStatus?.(status)
    }
  })

  source.onerror = (error) => {
    onError?.(error)
  }

  return source
}
