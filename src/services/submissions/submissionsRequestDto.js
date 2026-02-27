export const toQuizSubmissionRequest = (payload = {}) => {
  const { choiceId, idempotencyKey, attemptId, sessionId } = payload

  return {
    choiceId,
    idempotencyKey,
    attemptId: attemptId ?? null,
    sessionId: sessionId ?? null,
  }
}
