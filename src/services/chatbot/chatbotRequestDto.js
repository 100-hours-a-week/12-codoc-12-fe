export const toChatbotMessageRequest = (payload = {}) => {
  const { problemId, message } = payload

  return {
    problemId,
    message,
  }
}

export const toChatbotConversationListParams = (params = {}) => {
  const nextParams = {}
  const normalizedProblemId = Number(params.problemId)

  if (Number.isInteger(normalizedProblemId) && normalizedProblemId > 0) {
    nextParams.problemId = normalizedProblemId
  }
  if (params.cursor !== undefined && params.cursor !== null) {
    nextParams.cursor = params.cursor
  }
  if (params.limit !== undefined && params.limit !== null) {
    nextParams.limit = params.limit
  }

  return nextParams
}
