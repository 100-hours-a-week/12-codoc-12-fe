const SUBMISSION_STATUS_MAP = {
  NOT_SUBMITTED: 'not_submitted',
  SUBMITTED: 'submitted',
}

const normalizeSubmissionStatus = (value) => SUBMISSION_STATUS_MAP[value ?? ''] ?? 'not_submitted'

const toChoiceItems = (choices = []) =>
  Array.isArray(choices)
    ? choices.map((choice, index) => ({
        id: `choice-${index + 1}`,
        choiceNo: index + 1,
        content: choice ?? '',
      }))
    : []

export const toSurpriseQuizResponse = (apiResponse) => {
  const data = apiResponse?.data ?? {}
  const quiz = data.quiz ?? null

  return {
    submissionStatus: normalizeSubmissionStatus(data.submissionStatus),
    isCorrect: typeof data.isCorrect === 'boolean' ? data.isCorrect : null,
    rank: Number.isFinite(data.rank) ? data.rank : null,
    elapsedMs: Number.isFinite(data.elapsedMs) ? data.elapsedMs : null,
    eventEndsAt: data.eventEndsAt ?? null,
    quiz: quiz
      ? {
          content: quiz.content ?? '',
          choices: toChoiceItems(quiz.choices),
        }
      : null,
  }
}

export const toSurpriseQuizSubmissionResponse = (apiResponse) => {
  const data = apiResponse?.data ?? {}

  return {
    rank: Number.isFinite(data.rank) ? data.rank : null,
    elapsedMs: Number.isFinite(data.elapsedMs) ? data.elapsedMs : null,
  }
}
