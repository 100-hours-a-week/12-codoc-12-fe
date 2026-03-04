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

const DIFFICULTY_MAP = {
  ONE: 1,
  TWO: 2,
  THREE: 3,
  FOUR: 4,
  FIVE: 5,
}

const DEFAULT_STATUS = 'not_attempted'

const mapSummaryCards = (cards = []) =>
  Array.isArray(cards)
    ? cards.map((card, index) => {
        const safeCard = card ?? {}
        return {
          id: safeCard.summaryCardId ?? `summary-${index}`,
          paragraphType: safeCard.paragraphType ?? '',
          choices: Array.isArray(safeCard.choices) ? safeCard.choices : [],
        }
      })
    : []

const mapQuizzes = (quizzes = []) =>
  Array.isArray(quizzes)
    ? quizzes.map((quiz, index) => {
        const safeQuiz = quiz ?? {}
        return {
          id: safeQuiz.quizId ?? `quiz-${index}`,
          question: safeQuiz.question ?? '',
          choices: Array.isArray(safeQuiz.choices) ? safeQuiz.choices : [],
        }
      })
    : []

const normalizeStatus = (status) => STATUS_MAP[status ?? ''] ?? DEFAULT_STATUS

const normalizeDifficulty = (difficulty) => {
  if (typeof difficulty === 'number') {
    return difficulty
  }
  return DIFFICULTY_MAP[difficulty] ?? difficulty
}

export const toProblemListItem = (item = {}) => {
  const safeItem = item ?? {}

  return {
    id: safeItem.problemId ?? safeItem.id ?? null,
    title: safeItem.title ?? '',
    difficulty: normalizeDifficulty(safeItem.difficulty ?? safeItem.level),
    status: normalizeStatus(safeItem.status),
    bookmarked: Boolean(safeItem.bookmarked),
  }
}

export const toProblemDetail = (item = {}) => ({
  id: item.problemId ?? item.id ?? null,
  title: item.title ?? '',
  difficulty: normalizeDifficulty(item.difficulty ?? item.level),
  status: normalizeStatus(item.status),
  bookmarked: Boolean(item.bookmarked),
  content: item.content ?? '',
  summaryCards: mapSummaryCards(item.summaryCards),
  quizzes: mapQuizzes(item.quizzes),
})

export const toProblemSession = (item = {}) => ({
  sessionId: item.sessionId ?? null,
  problemId: item.problemId ?? null,
  expiresAt: item.expiresAt ?? null,
  chatbotCompletedAt: item.chatbotCompletedAt ?? item.chatbot_completed_at ?? null,
  summaryCards: mapSummaryCards(item.summaryCards),
  quizzes: mapQuizzes(item.quizzes),
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

export const toProblemDetailResponse = (apiResponse) => {
  const data = apiResponse?.data ?? {}
  return toProblemDetail(data)
}

export const toProblemSessionResponse = (apiResponse) => {
  const data = apiResponse?.data ?? {}
  return toProblemSession(data)
}

export const toProblemBookmarkResponse = (_apiResponse, bookmarked) => ({
  bookmarked: Boolean(bookmarked),
})
