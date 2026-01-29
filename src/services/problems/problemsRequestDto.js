const STATUS_PARAM_MAP = {
  not_attempted: 'NOT_ATTEMPTED',
  in_progress: 'IN_PROGRESS',
  summary_card_passed: 'SUMMARY_CARD_PASSED',
  solved: 'SOLVED',
}

const DIFFICULTY_PARAM_MAP = {
  1: 'ONE',
  2: 'TWO',
  3: 'THREE',
  4: 'FOUR',
  5: 'FIVE',
}

const normalizeStatusParam = (status) => STATUS_PARAM_MAP[status] ?? status

const normalizeDifficultyParam = (difficulty) => {
  if (typeof difficulty === 'number') {
    return DIFFICULTY_PARAM_MAP[difficulty] ?? difficulty
  }
  return difficulty
}

export const toProblemListParams = (params = {}) => {
  const nextParams = {}
  const difficulties = params.difficulties

  if (params.cursor !== undefined && params.cursor !== null) {
    nextParams.cursor = params.cursor
  }
  if (params.limit !== undefined && params.limit !== null) {
    nextParams.limit = params.limit
  }
  if (params.query) {
    nextParams.query = params.query
  }
  if (Array.isArray(difficulties) && difficulties.length > 0) {
    nextParams.difficulties = difficulties.map(normalizeDifficultyParam)
  }
  if (Array.isArray(params.statuses) && params.statuses.length > 0) {
    nextParams.statuses = params.statuses.map(normalizeStatusParam)
  }
  if (params.bookmarked === true) {
    nextParams.bookmarked = true
  }

  return nextParams
}
