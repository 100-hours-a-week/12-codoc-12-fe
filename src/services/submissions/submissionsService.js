import { requestProblemSubmission, requestQuizSubmission } from './submissionsApi'
import { toProblemSubmissionResponse, toQuizSubmissionResponse } from './submissionsDto'
import { toQuizSubmissionRequest } from './submissionsRequestDto'

export const submitQuiz = async (quizId, payload = {}) => {
  const response = await requestQuizSubmission(quizId, toQuizSubmissionRequest(payload))
  return toQuizSubmissionResponse(response)
}

export const submitProblem = async (problemId) => {
  const response = await requestProblemSubmission(problemId)
  return toProblemSubmissionResponse(response)
}
