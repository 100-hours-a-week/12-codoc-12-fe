const STATUS_MAP = {
  NOT_ATTEMPTED: 'not_attempted',
  IN_PROGRESS: 'in_progress',
  SUMMARY_CARD_PASSED: 'summary_card_passed',
  SOLVED: 'solved',
  '': 'not_attempted',
}

const normalizeStatus = (status) => STATUS_MAP[status ?? ''] ?? 'not_attempted'

export const toQuizSubmissionResponse = (apiResponse) => {
  const data = apiResponse?.data ?? {}

  return {
    result: Boolean(data.result),
    attemptId: data.attemptId ?? null,
  }
}

export const toProblemSubmissionResponse = (apiResponse) => {
  const data = apiResponse?.data ?? {}

  return {
    correctCount: Number.isFinite(data.correctCount) ? data.correctCount : 0,
    nextStatus: normalizeStatus(data.nextStatus),
    xpGranted: Boolean(data.xpGranted),
  }
}
