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

const buildIdempotencyKey = (quizId) =>
  `${quizId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

const getOptionLabel = (index) => String.fromCharCode(65 + index)

export default function Quiz() {
  const { problemId } = useParams()
  const navigate = useNavigate()
  const [problem, setProblem] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [actionError, setActionError] = useState(null)

  const { sessions, initSession, updateSession, resetSession } = useQuizStore()
  const session = problemId ? sessions[String(problemId)] : null
  const currentIndex = session?.currentIndex ?? 0
  const selectedChoices = useMemo(() => session?.selectedChoices ?? {}, [session?.selectedChoices])
  const results = useMemo(() => session?.results ?? {}, [session?.results])
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
          setProblem(data)
          initSession(problemId)
        }
      } catch {
        if (isActive) {
          setLoadError('퀴즈 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.')
          setProblem(null)
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
      updateSession(problemId, {
        results: nextResults,
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
                tab.id === ACTIVE_TAB_ID ? 'text-foreground' : 'text-muted-foreground'
              }`}
              onClick={() => {
                if (!problemId) {
                  return
                }
                if (tab.id === 'problem') {
                  navigate(`/problems/${problemId}`)
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
          <p className="text-sm text-red-500">{loadError}</p>
          <Button className="mt-4" onClick={() => window.location.reload()} variant="secondary">
            다시 시도
          </Button>
        </Card>
      ) : totalQuestions === 0 ? (
        <Card className="border-dashed border-muted-foreground/40 bg-muted/40 p-6 text-center">
          <p className="text-sm text-muted-foreground">등록된 퀴즈가 없습니다.</p>
        </Card>
      ) : isResultView ? (
        <Card className="bg-muted/40">
          <CardContent className="space-y-6 p-6 text-center">
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
              <Button className="w-full rounded-xl" onClick={handleRestart} variant="secondary">
                다시 풀어보기
              </Button>
              <Button className="w-full rounded-xl" onClick={handleGoHome} variant="outline">
                홈으로 돌아가기
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
            <span>
              질문 {currentIndex + 1}/{totalQuestions}
            </span>
            <span>맞힌 개수: {correctCount}</span>
          </div>
          <progress
            className="h-2 w-full overflow-hidden rounded-full accent-foreground"
            max={totalQuestions}
            value={currentIndex + 1}
          />

          <Card className="bg-muted/40">
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
              return (
                <button
                  key={`${currentQuiz.id}-choice-${index}`}
                  className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 focus-visible:ring-offset-2 ${
                    isSelected
                      ? 'border-foreground/60 bg-muted text-foreground'
                      : 'border-muted-foreground/20 bg-background text-foreground hover:border-foreground/30 hover:bg-muted/40'
                  } disabled:cursor-not-allowed disabled:opacity-60`}
                  disabled={isSubmitting || hasAnsweredCurrent}
                  onClick={() => handleSelectChoice(index)}
                  type="button"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold">
                    {getOptionLabel(index)}
                  </span>
                  <span>{choice}</span>
                </button>
              )
            })}
          </div>

          {hasAnsweredCurrent ? (
            <Card className="bg-muted/60">
              <CardContent className="flex items-center gap-2 p-4 text-sm font-semibold">
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full border ${
                    currentResult
                      ? 'border-emerald-300 bg-emerald-100'
                      : 'border-rose-300 bg-rose-100'
                  }`}
                >
                  {currentResult ? '✓' : '✕'}
                </span>
                {currentResult ? '정답입니다!' : '오답입니다.'}
              </CardContent>
            </Card>
          ) : null}

          {actionError ? <p className="text-xs text-red-500">{actionError}</p> : null}

          <Button
            className={`w-full rounded-xl ${
              hasAnsweredCurrent ||
              (!hasAnsweredCurrent &&
                selectedChoiceIndex !== null &&
                selectedChoiceIndex !== undefined)
                ? 'bg-foreground text-background hover:bg-foreground/90'
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
      )}
    </div>
  )
}
