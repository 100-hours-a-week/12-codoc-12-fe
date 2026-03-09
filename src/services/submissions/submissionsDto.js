const STATUS_MAP = {
  NOT_ATTEMPTED: 'not_attempted',
  IN_PROGRESS: 'in_progress',
  SUMMARY_CARD_PASSED: 'summary_card_passed',
  SOLVED: 'solved',
  '': 'not_attempted',
}

const normalizeStatus = (status) => STATUS_MAP[status ?? ''] ?? 'not_attempted'
const SECOND_MS = 1000
const MINUTE_MS = 60 * SECOND_MS
const HOUR_MS = 60 * MINUTE_MS

const toTimestamp = (value) => {
  if (!value) {
    return null
  }

  const date = new Date(value)
  const time = date.getTime()
  return Number.isNaN(time) ? null : time
}

const toSolvingDurationMs = (createdAt, closedAt) => {
  const createdAtTime = toTimestamp(createdAt)
  const closedAtTime = toTimestamp(closedAt)

  if (createdAtTime === null || closedAtTime === null) {
    return null
  }

  const duration = closedAtTime - createdAtTime
  return duration >= 0 ? duration : null
}

const toDurationLabel = (durationMs) => {
  if (!Number.isFinite(durationMs) || durationMs === null) {
    return ''
  }

  const safeDuration = Math.max(0, Math.floor(durationMs))
  const hours = Math.floor(safeDuration / HOUR_MS)
  const minutes = Math.floor((safeDuration % HOUR_MS) / MINUTE_MS)
  const seconds = Math.floor((safeDuration % MINUTE_MS) / SECOND_MS)

  if (hours > 0) {
    return `${hours}시간 ${minutes}분 ${seconds}초`
  }

  if (minutes > 0) {
    return `${minutes}분 ${seconds}초`
  }

  return `${seconds}초`
}

export const toQuizSubmissionResponse = (apiResponse) => {
  const data = apiResponse?.data ?? {}

  return {
    result: Boolean(data.result),
    attemptId: data.attemptId ?? null,
    explanation: data.explanation ?? '',
  }
}

export const toProblemSubmissionResponse = (apiResponse) => {
  const data = apiResponse?.data ?? {}
  const createdAt = data.createdAt ?? data.created_at ?? null
  const closedAt = data.closedAt ?? data.closed_at ?? null
  const solvingDurationMs = toSolvingDurationMs(createdAt, closedAt)

  return {
    correctCount: Number.isFinite(data.correctCount) ? data.correctCount : 0,
    nextStatus: normalizeStatus(data.nextStatus),
    xpGranted: Boolean(data.xpGranted),
    createdAt,
    closedAt,
    solvingDurationMs,
    solvingDurationLabel: toDurationLabel(solvingDurationMs),
  }
}
