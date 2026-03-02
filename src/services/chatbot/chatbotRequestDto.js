export const toChatbotMessageRequest = (payload = {}) => {
  const { problemId, message, sessionId } = payload

  return {
    problemId,
    message,
    sessionId: sessionId ?? null,
  }
}

export const toChatbotConversationListParams = (params = {}) => {
  const nextParams = {}
  const normalizedProblemId = Number(params.problemId)
  const sessionId = params.sessionId

  if (Number.isInteger(normalizedProblemId) && normalizedProblemId > 0) {
    nextParams.problemId = normalizedProblemId
  }
  if (sessionId) {
    nextParams.sessionId = sessionId
  }
  if (params.cursor !== undefined && params.cursor !== null) {
    nextParams.cursor = params.cursor
  }
  if (params.limit !== undefined && params.limit !== null) {
    nextParams.limit = params.limit
  }

  return nextParams
}

const normalizeConversationId = (conversationId) => {
  const normalizedConversationId = Number(conversationId)
  if (!Number.isInteger(normalizedConversationId) || normalizedConversationId <= 0) {
    return null
  }

  return normalizedConversationId
}

export const toChatbotStreamStopRequest = (conversationId) => {
  const normalizedConversationId = normalizeConversationId(conversationId)
  if (!normalizedConversationId) {
    return null
  }

  return {
    conversationId: normalizedConversationId,
  }
}

export const toChatbotStreamResumeRequest = (conversationId) => {
  const normalizedConversationId = normalizeConversationId(conversationId)
  if (!normalizedConversationId) {
    return null
  }

  return {
    conversationId: normalizedConversationId,
  }
}
