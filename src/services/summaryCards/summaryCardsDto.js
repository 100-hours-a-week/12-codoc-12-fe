const STATUS_MAP = {
  NOT_ATTEMPTED: 'not_attempted',
  IN_PROGRESS: 'in_progress',
  SUMMARY_CARD_PASSED: 'summary_card_passed',
  SOLVED: 'solved',
  '': 'not_attempted',
}

const normalizeStatus = (status) => STATUS_MAP[status ?? ''] ?? 'not_attempted'

export const toSummaryCardSubmissionResponse = (apiResponse) => {
  const data = apiResponse?.data ?? {}

  return {
    results: Array.isArray(data.results) ? data.results : [],
    status: normalizeStatus(data.status),
  }
}
