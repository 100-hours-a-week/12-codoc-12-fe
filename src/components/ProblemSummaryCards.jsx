import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { submitSummaryCards } from '@/services/summaryCards/summaryCardsService'
import { useSummaryCardStore } from '@/stores/useSummaryCardStore'

const SUMMARY_CARD_LABELS = {
  BACKGROUND: '문제 배경',
  GOAL: '문제 목표',
  RULE: '핵심 규칙',
  CONSTRAINT: '제약 사항',
}

const SUMMARY_CARD_PROMPTS = {
  BACKGROUND: '이 문제는',
  GOAL: '에서',
  RULE: '을(를) 사용해',
  CONSTRAINT: '을 만족하는',
}

export default function ProblemSummaryCards({
  summaryCards,
  problemId,
  onClose,
  onStatusChange,
  onQuizStart,
}) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { sessions, updateSession, resetSession } = useSummaryCardStore()
  const session = problemId ? sessions[String(problemId)] : null
  const selectedChoices = useMemo(() => session?.selectedChoices ?? {}, [session?.selectedChoices])
  const gradingResults = useMemo(() => session?.gradingResults ?? [], [session?.gradingResults])

  const handleSelectChoice = (cardKey, choiceIndex) => {
    if (!problemId) {
      return
    }
    if (selectedChoices[cardKey] === choiceIndex) {
      const next = { ...selectedChoices }
      delete next[cardKey]
      updateSession(problemId, { selectedChoices: next })
      return
    }
    updateSession(problemId, {
      selectedChoices: { ...selectedChoices, [cardKey]: choiceIndex },
    })
  }

  const isSubmitEnabled = useMemo(() => {
    if (!problemId || summaryCards.length === 0) {
      return false
    }
    return summaryCards.every((card, index) => {
      const cardKey = card.id ?? `summary-${index}`
      return selectedChoices[cardKey] !== undefined
    })
  }, [problemId, selectedChoices, summaryCards])

  const handleSubmit = async () => {
    if (!isSubmitEnabled || isSubmitting) {
      return
    }

    const choiceIds = summaryCards.map((card, index) => {
      const cardKey = card.id ?? `summary-${index}`
      return selectedChoices[cardKey]
    })

    setIsSubmitting(true)
    try {
      const response = await submitSummaryCards({ problemId, choiceIds })
      updateSession(problemId, { gradingResults: response.results ?? [] })
      if (response.status && onStatusChange) {
        onStatusChange(response.status)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const isGraded = gradingResults.length > 0
  const allCorrect =
    isGraded && gradingResults.length === summaryCards.length && gradingResults.every(Boolean)

  const handleReset = () => {
    resetSession(problemId)
  }

  return (
    <div className="space-y-5 pb-10">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">문제 요약 카드</h3>
        <Button className="px-2 text-xs" onClick={onClose} type="button" variant="ghost">
          닫기
        </Button>
      </div>

      <div>
        <p className="text-center text-sm font-semibold text-foreground">
          빈칸을 채워 문제를 요약해보세요
        </p>
      </div>
      <Card className="rounded-3xl bg-muted/60">
        <CardContent className="space-y-4 p-4">
          <div className="space-y-4">
            {summaryCards.map((card, index) => {
              const cardKey = card.id ?? `summary-${index}`
              const selectedChoiceIndex = selectedChoices[cardKey]
              const placeholder = SUMMARY_CARD_LABELS[card.paragraphType] ?? '빈칸'
              const prompt = SUMMARY_CARD_PROMPTS[card.paragraphType] ?? '이 문제는'
              const selectedChoice =
                selectedChoiceIndex !== undefined ? card.choices[selectedChoiceIndex] : null
              const isCorrect = gradingResults[index]

              return (
                <div key={cardKey} className="space-y-3 pl-3">
                  {/* 문단 프롬프트 */}
                  <p className="text-sm font-semibold text-foreground">{prompt}</p>

                  {/* 빈칸 */}
                  <div
                    className={`inline-flex min-w-[4rem] items-center justify-center rounded-md border px-3 py-2 text-sm font-normal ${
                      selectedChoice
                        ? isGraded
                          ? isCorrect
                            ? 'border-emerald-200 bg-emerald-100 text-emerald-900'
                            : 'border-rose-200 bg-rose-100 text-rose-900'
                          : 'border-transparent bg-foreground text-background'
                        : 'border-dashed border-border bg-background text-foreground/80'
                    }`}
                  >
                    {selectedChoice ?? placeholder}
                  </div>

                  {/* 선택지 */}
                  {card.choices.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {card.choices.map((choice, choiceIndex) => {
                        const isSelected = selectedChoiceIndex === choiceIndex
                        return (
                          <button
                            key={`${cardKey}-choice-${choiceIndex}`}
                            className={`rounded-md border px-3 py-2 text-sm font-semibold transition ${
                              isSelected
                                ? 'border-foreground/60 bg-background text-foreground'
                                : 'border-muted-foreground/30 bg-background text-foreground/80'
                            }`}
                            disabled={isGraded}
                            onClick={() => handleSelectChoice(cardKey, choiceIndex)}
                            type="button"
                          >
                            {choice}
                          </button>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">선택지가 없습니다.</p>
                  )}
                </div>
              )
            })}
            {summaryCards.length === 0 ? (
              <p className="text-sm text-muted-foreground">요약 카드 데이터가 없습니다.</p>
            ) : null}
            {summaryCards.length > 0 ? (
              <div className="space-y-3 pl-3">
                <p className="text-sm font-semibold text-foreground">를 구하는 문제이다.</p>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {isGraded ? (
        <Card className="rounded-xl bg-muted/70">
          <CardContent className="space-y-4 p-4">
            <div className="text-center text-base">
              {allCorrect ? '완벽합니다! 문제를 정확히 이해하셨네요!' : '다시 도전해보세요!'}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Button
        className={`w-full rounded-xl ${
          isSubmitEnabled && !isGraded ? 'bg-foreground text-background hover:bg-foreground/90' : ''
        }`}
        disabled={isSubmitting || (!isSubmitEnabled && !isGraded)}
        onClick={() => {
          if (isGraded) {
            if (allCorrect) {
              onQuizStart?.()
              return
            }
            handleReset()
            return
          }
          handleSubmit()
        }}
        type="button"
        variant={isGraded ? 'default' : 'secondary'}
      >
        {isGraded ? (allCorrect ? '퀴즈 풀기' : '다시 풀기') : '제출하기'}
      </Button>

      <div className="mb-4 rounded-xl bg-muted/60 px-4 py-3 text-xs text-muted-foreground">
        문제의 핵심을 파악하면 해결 방법이 명확해집니다. 요약 카드를 완성하고 알고리즘 퀴즈로
        넘어가세요!
      </div>
    </div>
  )
}
