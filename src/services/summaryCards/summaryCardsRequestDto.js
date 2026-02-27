export const toSummaryCardSubmissionRequest = (payload = {}) => {
  const { problemId, choiceIds, sessionId } = payload

  return {
    problemId,
    sessionId: sessionId ?? null,
    choiceIds: Array.isArray(choiceIds) ? choiceIds : [],
  }
}
