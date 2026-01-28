import { requestSummaryCardSubmission } from './summaryCardsApi'
import { toSummaryCardSubmissionResponse } from './summaryCardsDto'
import { toSummaryCardSubmissionRequest } from './summaryCardsRequestDto'

export const submitSummaryCards = async (payload = {}) => {
  const response = await requestSummaryCardSubmission(toSummaryCardSubmissionRequest(payload))
  return toSummaryCardSubmissionResponse(response)
}
