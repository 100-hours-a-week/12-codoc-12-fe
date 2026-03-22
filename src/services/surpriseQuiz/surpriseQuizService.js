import { requestSurpriseQuiz, requestSurpriseQuizSubmission } from './surpriseQuizApi'
import { toSurpriseQuizResponse, toSurpriseQuizSubmissionResponse } from './surpriseQuizDto'

export const getSurpriseQuiz = async () => {
  const response = await requestSurpriseQuiz()
  return toSurpriseQuizResponse(response)
}

export const submitSurpriseQuiz = async (payload = {}) => {
  const response = await requestSurpriseQuizSubmission(payload)
  return toSurpriseQuizSubmissionResponse(response)
}
