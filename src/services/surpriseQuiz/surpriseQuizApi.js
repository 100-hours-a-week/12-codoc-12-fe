import { api } from '@/lib/api'

export const requestSurpriseQuiz = async () => {
  const response = await api.get('/api/events/surprise/quiz')
  return response.data
}

export const requestSurpriseQuizSubmission = async (payload) => {
  const response = await api.post('/api/events/surprise/quiz/submissions', payload)
  return response.data
}
