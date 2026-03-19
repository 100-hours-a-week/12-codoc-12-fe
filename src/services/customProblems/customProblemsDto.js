const STATUS_MAP = {
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
}

export const toCustomProblemListItem = (item = {}) => ({
  id: item.customProblemId ?? null,
  title: item.title ?? '',
  status: STATUS_MAP[item.status] ?? item.status,
  createdAt: item.createdAt ?? null,
})

export const toCustomProblemListResponse = (apiResponse) => {
  const data = apiResponse?.data ?? {}
  const items = Array.isArray(data.items) ? data.items : []
  return {
    items: items.map(toCustomProblemListItem),
    nextCursor: data.nextCursor ?? null,
    hasNextPage: Boolean(data.hasNextPage),
  }
}

export const toCustomProblemCreateResponse = (apiResponse) => {
  const data = apiResponse?.data ?? {}
  return {
    id: data.customProblemId ?? null,
    status: STATUS_MAP[data.status] ?? data.status,
    createdAt: data.createdAt ?? null,
  }
}

export const toUploadUrlsResponse = (apiResponse) => {
  const data = apiResponse?.data ?? {}
  const images = Array.isArray(data.images) ? data.images : []
  return images.map((image) => ({
    order: image.order,
    fileKey: image.fileKey,
    uploadUrl: image.uploadUrl,
    expiresAt: image.expiresAt,
  }))
}

const mapSummaryCards = (cards = []) =>
  Array.isArray(cards)
    ? cards.map((card, index) => ({
        id: `custom-summary-${index}`,
        paragraphType: card.paragraphType ?? '',
        paragraphOrder: card.paragraphOrder ?? index,
        choices: Array.isArray(card.choices) ? card.choices : [],
        answerIndex: card.answerIndex ?? 0,
      }))
    : []

const mapQuizzes = (quizzes = []) =>
  Array.isArray(quizzes)
    ? quizzes.map((quiz, index) => ({
        id: quiz.quizId ?? `custom-quiz-${index}`,
        quizType: quiz.quizType ?? 'MULTIPLE_CHOICE',
        question: quiz.question ?? '',
        explanation: quiz.explanation ?? '',
        choices: Array.isArray(quiz.choices) ? quiz.choices : [],
        answerIndex: quiz.answerIndex ?? 0,
        sequence: quiz.sequence ?? index + 1,
      }))
    : []

export const toCustomProblemDetailResponse = (apiResponse) => {
  const data = apiResponse?.data ?? {}
  return {
    id: data.customProblemId ?? null,
    title: data.title ?? '',
    content: data.content ?? '',
    createdAt: data.createdAt ?? null,
    summaryCards: mapSummaryCards(data.summaryCards),
    quizzes: mapQuizzes(data.quizzes),
  }
}
