export const toQuizSubmissionRequest = (payload = {}) => {
  const { choiceId, idempotencyKey, attemptId } = payload

  return {
    choiceId,
    idempotencyKey,
    attemptId: attemptId ?? null,
  }
}
