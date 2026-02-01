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

const getCardKey = (card, index) => String(card.paragraphType ?? card.id ?? `summary-${index}`)

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
      const cardKey = getCardKey(card, index)
      return selectedChoices[cardKey] !== undefined
    })
  }, [problemId, selectedChoices, summaryCards])

  const handleSubmit = async () => {
    if (!isSubmitEnabled || isSubmitting) {
      return
    }

    const choiceIds = summaryCards.map((card, index) => {
      const cardKey = getCardKey(card, index)
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
              const cardKey = getCardKey(card, index)
              const selectedChoiceIndex = selectedChoices[cardKey]
              const hasSelection = selectedChoiceIndex !== undefined && selectedChoiceIndex !== null
              const selectedChoiceText =
                hasSelection && card.choices?.[selectedChoiceIndex]
                  ? card.choices[selectedChoiceIndex]
                  : null
              const placeholder = SUMMARY_CARD_LABELS[card.paragraphType] ?? '빈칸'
              const prompt = SUMMARY_CARD_PROMPTS[card.paragraphType] ?? '이 문제는'
              const isCorrect = gradingResults[index]

              return (
                <div key={cardKey} className="space-y-3 pl-3">
                  {/* 문단 프롬프트 */}
                  <p className="text-sm font-semibold text-foreground">{prompt}</p>

                  {/* 빈칸 */}
                  <div
                    className={`inline-flex min-w-[4rem] items-center justify-center rounded-md border-2 px-3 py-2 text-sm font-semibold ${
                      isGraded
                        ? isCorrect
                          ? 'bg-info-soft/80 text-info-soft-foreground'
                          : 'bg-danger-soft/80 text-danger-soft-foreground'
                        : hasSelection
                          ? 'border-dashed border-muted-foreground/40 bg-muted/40 text-foreground'
                          : 'border-dashed border-muted-foreground/40 bg-muted/40 text-muted-foreground'
                    }`}
                  >
                    {selectedChoiceText ?? placeholder}
                  </div>

                  {/* 선택지 */}
                  {card.choices.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      {card.choices.map((choice, choiceIndex) => {
                        const isSelected = selectedChoiceIndex === choiceIndex
                        const isSelectedActive = isSelected
                        return (
                          <button
                            key={`${cardKey}-choice-${choiceIndex}`}
                            className={`w-full min-h-12 rounded-xl border px-4 py-3 text-left text-sm font-semibold transition ${
                              isSelectedActive
                                ? 'border-2 border-info-soft-foreground bg-background text-foreground'
                                : 'border-muted-foreground/25 bg-background text-muted-foreground hover:border-muted-foreground/35 hover:text-foreground'
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
        <Card
          className={`rounded-xl ${
            allCorrect
              ? 'border-2 border-info-muted bg-info-soft/80'
              : 'border-2 border-danger-muted bg-danger-soft/80'
          }`}
        >
          <CardContent className="space-y-4 p-4">
            <div
              className={`text-center text-base ${
                allCorrect ? 'text-info-soft-foreground' : 'text-danger-soft-foreground'
              }`}
            >
              {allCorrect ? '완벽합니다! 문제를 정확히 이해하셨네요!' : '다시 도전해보세요!'}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Button
        className={`w-full rounded-xl ${
          isGraded
            ? allCorrect
              ? 'bg-info text-info-foreground hover:bg-info/90'
              : 'bg-danger text-danger-foreground hover:bg-danger/90'
            : isSubmitEnabled
              ? 'bg-info text-info-foreground hover:bg-info/90'
              : ''
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
