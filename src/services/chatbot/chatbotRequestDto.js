export const toChatbotMessageRequest = (payload = {}) => {
  const { problemId, message } = payload

  return {
    problemId,
    message,
  }
}
