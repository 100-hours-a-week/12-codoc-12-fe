import { BookOpen, Brain, Clover, Trophy } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { getProblemDetail } from '@/services/problems/problemsService'
import { submitProblem, submitQuiz } from '@/services/submissions/submissionsService'
import { useQuizStore } from '@/stores/useQuizStore'

const TAB_ITEMS = [
  { id: 'problem', label: '문제', Icon: BookOpen },
  { id: 'chatbot', label: 'AI 챗봇', Icon: Brain },
  { id: 'quiz', label: '퀴즈', Icon: Clover },
]

const ACTIVE_TAB_ID = 'quiz'
const QUIZ_ALLOWED_STATUSES = ['summary_card_passed', 'solved']

const buildIdempotencyKey = (quizId) =>
  `${quizId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

const getOptionLabel = (index) => String.fromCharCode(65 + index)

export default function Quiz() {
  const { problemId } = useParams()
  const navigate = useNavigate()
  const [problem, setProblem] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [isBlocked, setIsBlocked] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [actionError, setActionError] = useState(null)

  const { sessions, initSession, updateSession, resetSession } = useQuizStore()
  const session = problemId ? sessions[String(problemId)] : null
  const currentIndex = session?.currentIndex ?? 0
  const selectedChoices = useMemo(() => session?.selectedChoices ?? {}, [session?.selectedChoices])
  const results = useMemo(() => session?.results ?? {}, [session?.results])
  const explanations = useMemo(() => session?.explanations ?? {}, [session?.explanations])
  const attemptId = session?.attemptId ?? null
  const isResultView = session?.isResultView ?? false
  const submissionResult = session?.submissionResult ?? null
  const quizzes = useMemo(() => problem?.quizzes ?? [], [problem])
  const totalQuestions = quizzes.length

  useEffect(() => {
    let isActive = true

    const fetchProblem = async () => {
      if (!problemId) {
        if (isActive) {
          setLoadError('문제 정보를 찾을 수 없습니다.')
          setProblem(null)
          setIsLoading(false)
        }
        return
      }

      setIsLoading(true)
      setLoadError(null)

      try {
        const data = await getProblemDetail(problemId)
        if (isActive) {
          const canAccessQuiz = QUIZ_ALLOWED_STATUSES.includes(data.status ?? '')
          setProblem(data)
          setIsBlocked(!canAccessQuiz)
          if (canAccessQuiz) {
            initSession(problemId)
          }
        }
      } catch {
        if (isActive) {
          setLoadError('퀴즈 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.')
          setProblem(null)
          setIsBlocked(false)
        }
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    fetchProblem()

    return () => {
      isActive = false
    }
  }, [initSession, problemId])

  useEffect(() => {
    if (!problemId || totalQuestions === 0) {
      return
    }
    if (currentIndex > totalQuestions - 1) {
      updateSession(problemId, { currentIndex: totalQuestions - 1 })
    }
  }, [currentIndex, problemId, totalQuestions, updateSession])
  const currentQuiz = quizzes[currentIndex]
  const correctCount = useMemo(() => Object.values(results).filter(Boolean).length, [results])

  const hasAnsweredCurrent = useMemo(() => {
    if (!currentQuiz) {
      return false
    }
    return Object.prototype.hasOwnProperty.call(results, currentQuiz.id)
  }, [currentQuiz, results])

  const currentResult = currentQuiz ? results[currentQuiz.id] : null
  const selectedChoiceIndex = currentQuiz ? selectedChoices[currentQuiz.id] : null
  const currentExplanation = currentQuiz ? explanations[currentQuiz.id] : ''

  const handleSelectChoice = (choiceIndex) => {
    if (!currentQuiz || isSubmitting || hasAnsweredCurrent) {
      return
    }
    setActionError(null)
    updateSession(problemId, {
      selectedChoices: { ...selectedChoices, [currentQuiz.id]: choiceIndex },
    })
  }

  const handleSubmitCurrent = async () => {
    if (!currentQuiz || isSubmitting || hasAnsweredCurrent) {
      return
    }

    if (selectedChoiceIndex === null || selectedChoiceIndex === undefined) {
      setActionError('선택지를 골라주세요.')
      return
    }

    setActionError(null)
    setIsSubmitting(true)

    try {
      const response = await submitQuiz(currentQuiz.id, {
        choiceId: selectedChoiceIndex,
        idempotencyKey: buildIdempotencyKey(currentQuiz.id),
        attemptId,
      })
      const nextResults = { ...results, [currentQuiz.id]: response.result }
      const nextExplanations = { ...explanations, [currentQuiz.id]: response.explanation ?? '' }
      updateSession(problemId, {
        results: nextResults,
        explanations: nextExplanations,
        attemptId: response.attemptId ?? attemptId,
      })
    } catch {
      setActionError('답안을 제출하지 못했습니다. 다시 시도해주세요.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleNext = () => {
    if (currentIndex < totalQuestions - 1) {
      updateSession(problemId, { currentIndex: currentIndex + 1 })
    }
  }

  const handleShowResult = async () => {
    if (!problemId || isSubmitting) {
      return
    }

    setActionError(null)
    setIsSubmitting(true)
    try {
      const response = await submitProblem(problemId)
      updateSession(problemId, { submissionResult: response, isResultView: true })
    } catch {
      setActionError('결과를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRestart = () => {
    resetSession(problemId)
  }

  const handleGoHome = () => {
    navigate('/')
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-muted/70 px-2">
        <div className="grid grid-cols-3">
          {TAB_ITEMS.map((tab) => (
            <button
              key={tab.id}
              className={`flex flex-col items-center justify-center gap-1 px-3 py-3 text-xs font-semibold transition ${
                tab.id === ACTIVE_TAB_ID ? 'text-foreground' : 'text-neutral-500'
              }`}
              onClick={() => {
                if (!problemId) {
                  return
                }
                if (tab.id === 'problem') {
                  navigate(`/problems/${problemId}`)
                }
                if (tab.id === 'chatbot') {
                  navigate(`/problems/${problemId}/chatbot`)
                }
              }}
              type="button"
            >
              <tab.Icon className="h-5 w-5" />
              {tab.label}
              <span
                className={`mt-1 h-[2px] w-12 rounded-full ${
                  tab.id === ACTIVE_TAB_ID ? 'bg-foreground' : 'bg-transparent'
                }`}
              />
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <Card className="border-dashed border-muted-foreground/40 bg-muted/40 p-6 text-center">
          <p className="text-sm text-muted-foreground">퀴즈를 불러오는 중입니다.</p>
        </Card>
      ) : loadError ? (
        <Card className="border-dashed border-muted-foreground/40 bg-muted/40 p-6 text-center">
          <p className="text-sm text-danger">{loadError}</p>
          <Button className="mt-4" onClick={() => window.location.reload()} variant="secondary">
            다시 시도
          </Button>
        </Card>
      ) : isBlocked ? (
        <Card className="border-dashed border-muted-foreground/40 bg-muted/40 p-6 text-center">
          <p className="text-sm text-muted-foreground">
            요약 카드를 완료한 문제만 퀴즈를 풀 수 있어요.
          </p>
          <div className="mt-4 flex flex-col gap-2">
            <Button
              className="w-full rounded-xl"
              onClick={() => {
                if (problemId) {
                  navigate(`/problems/${problemId}`, { state: { openSummary: true } })
                }
              }}
              type="button"
              variant="secondary"
            >
              요약 카드 풀러 가기
            </Button>
          </div>
        </Card>
      ) : totalQuestions === 0 ? (
        <Card className="border-dashed border-muted-foreground/40 bg-muted/40 p-6 text-center">
          <p className="text-sm text-muted-foreground">등록된 퀴즈가 없습니다.</p>
        </Card>
      ) : isResultView ? (
        <div className="flex min-h-[70vh] flex-col items-center justify-center">
          <div className="w-full space-y-6 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-background shadow-sm">
                <Trophy className="h-10 w-10" />
              </div>
              <div className="space-y-1">
                <p className="text-lg font-semibold">퀴즈 완료!</p>
                <p className="text-2xl font-semibold">
                  {submissionResult?.correctCount ?? correctCount}/{totalQuestions}
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Button
                className="w-full rounded-xl border-2 border-border"
                onClick={handleRestart}
                variant="secondary"
              >
                다시 풀어보기
              </Button>
              <Button
                className="w-full rounded-xl border-2"
                onClick={handleGoHome}
                variant="outline"
              >
                홈으로 돌아가기
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex min-h-full flex-col">
          <div className="flex-1 space-y-4 pb-24">
            <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
              <span>
                질문 {currentIndex + 1}/{totalQuestions}
              </span>
              <span>맞힌 개수: {correctCount}</span>
            </div>
            <progress
              className="quiz-progress h-2 w-full overflow-hidden rounded-full"
              max={totalQuestions}
              value={currentIndex + 1}
            />

            <Card>
              <CardContent className="space-y-4 p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-md border bg-background text-sm font-semibold">
                    {currentIndex + 1}
                  </span>
                  <p className="text-sm font-semibold text-foreground">{currentQuiz?.question}</p>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-3">
              {currentQuiz?.choices?.map((choice, index) => {
                const isSelected = selectedChoiceIndex === index
                const isAnsweredSelected = hasAnsweredCurrent && isSelected
                const isCorrectAnswer = Boolean(currentResult)
                const showResultStyle = hasAnsweredCurrent
                const isDimmedOption = showResultStyle && !isAnsweredSelected
                return (
                  <button
                    key={`${currentQuiz.id}-choice-${index}`}
                    className={`flex w-full items-center gap-3 rounded-xl border-2 px-4 py-3 text-left text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 focus-visible:ring-offset-2 ${
                      showResultStyle
                        ? isAnsweredSelected
                          ? isCorrectAnswer
                            ? 'border-info-soft-foreground bg-background text-foreground'
                            : 'border-danger-soft-foreground bg-background text-foreground'
                          : 'border-muted-foreground/20 bg-background text-muted-foreground'
                        : isSelected
                          ? 'border-info-soft-foreground bg-background text-foreground'
                          : 'border-muted-foreground/20 bg-background text-foreground hover:border-info-muted'
                    } ${isDimmedOption ? 'opacity-50' : ''} ${
                      isSubmitting && !showResultStyle ? 'opacity-60' : ''
                    } disabled:cursor-not-allowed`}
                    disabled={isSubmitting || hasAnsweredCurrent}
                    onClick={() => handleSelectChoice(index)}
                    type="button"
                  >
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold ${
                        showResultStyle
                          ? isAnsweredSelected
                            ? isCorrectAnswer
                              ? 'border-info-soft-foreground bg-info-soft-foreground text-info-foreground'
                              : 'border-danger-soft-foreground bg-danger-soft-foreground text-danger-foreground'
                            : 'border-muted-foreground/10 bg-muted/50 text-muted-foreground'
                          : isSelected
                            ? 'border-info-soft-foreground bg-info-soft-foreground text-info-foreground'
                            : 'border-muted-foreground/20 bg-muted/40 text-muted-foreground'
                      }`}
                    >
                      {showResultStyle && isAnsweredSelected
                        ? isCorrectAnswer
                          ? '✓'
                          : '✕'
                        : getOptionLabel(index)}
                    </span>
                    <span>{choice}</span>
                  </button>
                )
              })}
            </div>

            {hasAnsweredCurrent && currentResult && currentExplanation ? (
              <Card className="bg-muted/40">
                <CardContent className="space-y-2 p-4">
                  <p className="text-sm font-semibold text-foreground">해설</p>
                  <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                    {currentExplanation}
                  </p>
                </CardContent>
              </Card>
            ) : null}

            {actionError ? <p className="text-xs text-red-500">{actionError}</p> : null}

            {actionError ? <p className="text-xs text-danger">{actionError}</p> : null}
          </div>

          <div className="fixed bottom-[var(--chatbot-input-bottom)] left-1/2 z-20 w-full max-w-[430px] -translate-x-1/2 px-4">
            <div className="rounded-2xl bg-background/95 pb-2 pt-2 backdrop-blur">
              <Button
                className={`w-full rounded-xl ${
                  hasAnsweredCurrent
                    ? currentResult
                      ? 'bg-info text-info-foreground hover:bg-info/90'
                      : 'bg-danger text-danger-foreground hover:bg-danger/90'
                    : selectedChoiceIndex !== null && selectedChoiceIndex !== undefined
                      ? 'bg-info text-info-foreground hover:bg-info/90'
                      : ''
                }`}
                disabled={
                  isSubmitting ||
                  (!hasAnsweredCurrent &&
                    (selectedChoiceIndex === null || selectedChoiceIndex === undefined))
                }
                onClick={
                  hasAnsweredCurrent
                    ? currentIndex === totalQuestions - 1
                      ? handleShowResult
                      : handleNext
                    : handleSubmitCurrent
                }
                type="button"
                variant="secondary"
              >
                {hasAnsweredCurrent
                  ? currentIndex === totalQuestions - 1
                    ? '결과 보기'
                    : '다음 질문'
                  : '제출하기'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
