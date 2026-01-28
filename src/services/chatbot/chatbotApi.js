import { api } from '@/lib/api'

export const requestChatbotMessage = async (payload) => {
  const response = await api.post('/api/chatbot/messages', payload)
  return response.data
}
