import ReactMarkdown from 'react-markdown'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import rehypeKatex from 'rehype-katex'
import remarkBreaks from 'remark-breaks'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'

import CustomProblemTabs from '@/components/customProblems/CustomProblemTabs'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { getCustomProblemDetail } from '@/services/customProblems/customProblemsService'
import { useCustomProblemDetailStore } from '@/stores/useCustomProblemDetailStore'
import { useCustomQuizStore } from '@/stores/useCustomQuizStore'

const ACTIVE_TAB_ID = 'quiz'

const markdownComponents = {
  p: ({ children }) => <span>{children}</span>,
}

const getOptionLabel = (index) => String.fromCharCode(65 + index)

export default function CustomQuiz() {
  const { customProblemId } = useParams()
  const [problem, setProblem] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [actionError, setActionError] = useState(null)

  const explanationRef = useRef(null)
  const { sessions, initSession, updateSession, resetSession } = useCustomQuizStore()
  const { fetchProblem: fetchCustomProblemDetail } = useCustomProblemDetailStore()
  const session = customProblemId ? sessions[String(customProblemId)] : null
  const currentIndex = session?.currentIndex ?? 0
  const selectedChoices = useMemo(() => session?.selectedChoices ?? {}, [session?.selectedChoices])
  const results = useMemo(() => session?.results ?? {}, [session?.results])
  const explanations = useMemo(() => session?.explanations ?? {}, [session?.explanations])

  const fetchDetail = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)
    try {
      const result = await fetchCustomProblemDetail(customProblemId, getCustomProblemDetail)
      setProblem(result)
      initSession(customProblemId)
    } catch {
      setLoadError('퀴즈 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.')
      setProblem(null)
    } finally {
      setIsLoading(false)
    }
  }, [customProblemId, fetchCustomProblemDetail, initSession])

  useEffect(() => {
    fetchDetail()
  }, [fetchDetail])

  const quizzes = useMemo(() => problem?.quizzes ?? [], [problem?.quizzes])
  const totalQuestions = quizzes.length
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
  const isLastQuestion = currentIndex === totalQuestions - 1
  const isPrimaryActionEnabled =
    hasAnsweredCurrent || (selectedChoiceIndex !== null && selectedChoiceIndex !== undefined)

  useEffect(() => {
    if (!customProblemId || totalQuestions === 0) {
      return
    }
    if (currentIndex > totalQuestions - 1) {
      updateSession(customProblemId, { currentIndex: totalQuestions - 1 })
    }
  }, [currentIndex, customProblemId, totalQuestions, updateSession])

  useEffect(() => {
    if (!hasAnsweredCurrent || !currentExplanation) {
      return
    }
    requestAnimationFrame(() => {
      explanationRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [currentExplanation, hasAnsweredCurrent])

  const handleSelectChoice = (choiceIndex) => {
    if (!currentQuiz || isSubmitting || hasAnsweredCurrent) {
      return
    }
    setActionError(null)
    updateSession(customProblemId, {
      selectedChoices: { ...selectedChoices, [currentQuiz.id]: choiceIndex },
    })
  }

  const handleSubmitCurrent = () => {
    if (!currentQuiz || isSubmitting || hasAnsweredCurrent) {
      return
    }

    if (selectedChoiceIndex === null || selectedChoiceIndex === undefined) {
      setActionError('선택지를 골라주세요.')
      return
    }

    setActionError(null)
    setIsSubmitting(true)

    const isCorrect = selectedChoiceIndex === currentQuiz.answerIndex
    const nextResults = { ...results, [currentQuiz.id]: isCorrect }
    const nextExplanations = { ...explanations, [currentQuiz.id]: currentQuiz.explanation ?? '' }

    updateSession(customProblemId, {
      results: nextResults,
      explanations: nextExplanations,
    })

    setIsSubmitting(false)
  }

  const handleNext = () => {
    if (currentIndex < totalQuestions - 1) {
      updateSession(customProblemId, { currentIndex: currentIndex + 1 })
    }
  }

  const handleRestart = () => {
    resetSession(customProblemId)
    initSession(customProblemId)
    setActionError(null)
  }

  return (
    <div className="space-y-5">
      <CustomProblemTabs activeTab={ACTIVE_TAB_ID} customProblemId={customProblemId} />

      {isLoading ? (
        <Card className="border-dashed border-muted-foreground/40 bg-muted/40 p-6 text-center">
          <p className="text-sm text-muted-foreground">퀴즈를 불러오는 중입니다.</p>
        </Card>
      ) : loadError ? (
        <Card className="border-dashed border-muted-foreground/40 bg-muted/40 p-6 text-center">
          <p className="text-sm text-danger">{loadError}</p>
          <Button className="mt-4" onClick={fetchDetail} type="button" variant="secondary">
            다시 시도
          </Button>
        </Card>
      ) : totalQuestions === 0 ? (
        <Card className="border-dashed border-muted-foreground/40 bg-muted/40 p-6 text-center">
          <p className="text-sm text-muted-foreground">등록된 퀴즈가 없습니다.</p>
        </Card>
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
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkBreaks, remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                    components={markdownComponents}
                  >
                    {currentQuiz?.question ?? ''}
                  </ReactMarkdown>
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
                            ? 'border-success text-foreground'
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
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${
                        showResultStyle
                          ? isAnsweredSelected
                            ? isCorrectAnswer
                              ? 'border-success bg-success text-success-foreground'
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
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm, remarkBreaks, remarkMath]}
                      rehypePlugins={[rehypeKatex]}
                      components={markdownComponents}
                    >
                      {choice}
                    </ReactMarkdown>
                  </button>
                )
              })}
            </div>

            {hasAnsweredCurrent && currentExplanation ? (
              <Card ref={explanationRef} className="bg-muted/40">
                <CardContent className="space-y-2 p-4">
                  <p className="text-sm font-semibold text-foreground">해설</p>
                  <div className="text-sm leading-relaxed text-muted-foreground">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm, remarkBreaks, remarkMath]}
                      rehypePlugins={[rehypeKatex]}
                      components={markdownComponents}
                    >
                      {currentExplanation}
                    </ReactMarkdown>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {actionError ? <p className="text-xs text-danger">{actionError}</p> : null}
          </div>

          <div className="fixed bottom-[var(--chatbot-input-bottom)] left-1/2 z-20 w-full max-w-[430px] -translate-x-1/2 px-4">
            <div className="rounded-2xl bg-background/95 pb-2 pt-2 backdrop-blur">
              <Button
                className={`w-full rounded-xl ${
                  isPrimaryActionEnabled
                    ? 'bg-info text-info-foreground hover:bg-info hover:opacity-100'
                    : ''
                }`}
                disabled={
                  isSubmitting ||
                  (!hasAnsweredCurrent &&
                    (selectedChoiceIndex === null || selectedChoiceIndex === undefined))
                }
                onClick={
                  hasAnsweredCurrent
                    ? isLastQuestion
                      ? handleRestart
                      : handleNext
                    : handleSubmitCurrent
                }
                type="button"
                variant="secondary"
              >
                {hasAnsweredCurrent ? (isLastQuestion ? '다시 풀기' : '다음 질문') : '제출하기'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
