export const toSummaryCardSubmissionRequest = (payload = {}) => {
  const { problemId, choiceIds } = payload

  return {
    problemId,
    choiceIds: Array.isArray(choiceIds) ? choiceIds : [],
  }
}
