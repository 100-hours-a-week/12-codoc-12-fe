const STATUS_MAP = {
  NOT_ATTEMPTED: 'not_attempted',
  IN_PROGRESS: 'in_progress',
  SUMMARY_CARD_PASSED: 'summary_card_passed',
  SOLVED: 'solved',
  '': 'not_attempted',
  미시도: 'not_attempted',
  '시도 중': 'in_progress',
  '요약 카드 해결': 'summary_card_passed',
  '문제 요약 카드 완료': 'summary_card_passed',
  해결: 'solved',
  성공: 'solved',
}

const LEVEL_MAP = {
  ONE: 1,
  TWO: 2,
  THREE: 3,
  FOUR: 4,
  FIVE: 5,
}

const DEFAULT_STATUS = 'not_attempted'

const normalizeStatus = (status) => STATUS_MAP[status ?? ''] ?? DEFAULT_STATUS

const normalizeLevel = (level) => {
  if (typeof level === 'number') {
    return level
  }
  return LEVEL_MAP[level] ?? level
}

export const toProblemListItem = (item) => ({
  id: item.problemId,
  title: item.title,
  level: normalizeLevel(item.level),
  status: normalizeStatus(item.status),
  bookmarked: Boolean(item.bookmarked),
})

export const toProblemListResponse = (apiResponse) => {
  const data = apiResponse?.data ?? {}
  const items = Array.isArray(data.items) ? data.items : []

  return {
    items: items.map(toProblemListItem),
    nextCursor: data.nextCursor ?? null,
    hasNextPage: Boolean(data.hasNextPage),
  }
}
