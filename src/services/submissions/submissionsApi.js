import { api } from '@/lib/api'

export const requestQuizSubmission = async (quizId, payload) => {
  const response = await api.post(`/api/quizzes/${quizId}/submissions`, payload)
  return response.data
}

export const requestProblemSubmission = async (problemId, payload) => {
  const response = await api.post(`/api/problems/${problemId}/submissions`, payload)
  return response.data
}
