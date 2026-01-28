import { api } from '@/lib/api'

export const requestSummaryCardSubmission = async (payload) => {
  const response = await api.post('/api/summary-cards/submissions', payload)
  return response.data
}
