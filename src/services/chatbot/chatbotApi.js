import { api } from '@/lib/api'

const serializeParams = (params = {}) => {
  const searchParams = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return
    }
    searchParams.append(key, value)
  })

  return searchParams.toString()
}

export const requestChatbotMessage = async (payload) => {
  const response = await api.post('/api/chatbot/messages', payload)
  return response.data
}

export const requestChatbotConversations = async (params = {}) => {
  const response = await api.get('/api/chatbot/conversations', {
    params,
    paramsSerializer: { serialize: serializeParams },
  })
  return response.data
}
