import { useEffect, useMemo, useState } from 'react'

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
  const [activeCardKey, setActiveCardKey] = useState(null)

  const cardEntries = useMemo(
    () =>
      summaryCards.map((card, index) => ({
        card,
        index,
        key: getCardKey(card, index),
      })),
    [summaryCards],
  )

  useEffect(() => {
    if (cardEntries.length === 0) {
      setActiveCardKey(null)
      return
    }
    const nextActive =
      cardEntries.find(({ key }) => selectedChoices[key] === undefined)?.key ?? cardEntries[0].key
    if (!activeCardKey || !cardEntries.some(({ key }) => key === activeCardKey)) {
      setActiveCardKey(nextActive)
    }
  }, [activeCardKey, cardEntries, selectedChoices])

  const handleSelectChoice = (cardKey, choiceIndex) => {
    if (!problemId) {
      return
    }
    updateSession(problemId, {
      selectedChoices: { ...selectedChoices, [cardKey]: choiceIndex },
    })
    const currentIndex = cardEntries.findIndex(({ key }) => key === cardKey)
    const nextCardKey =
      currentIndex >= 0 && currentIndex < cardEntries.length - 1
        ? cardEntries[currentIndex + 1].key
        : cardKey
    setActiveCardKey(nextCardKey)
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

      <div className="space-y-4">
        <div className="rounded-2xl border border-info-muted/60 bg-info-soft/30 p-4">
          <p className="text-center text-sm font-semibold text-info-soft-foreground">
            빈칸을 클릭해서 문제를 요약해보세요
          </p>
          <div className="mt-4 rounded-2xl bg-background p-4">
            <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
              {cardEntries.map(({ card, index, key }) => {
                const selectedChoiceIndex = selectedChoices[key]
                const hasSelection =
                  selectedChoiceIndex !== undefined && selectedChoiceIndex !== null
                const selectedChoiceText =
                  hasSelection && card.choices?.[selectedChoiceIndex]
                    ? card.choices[selectedChoiceIndex]
                    : null
                const placeholder = SUMMARY_CARD_LABELS[card.paragraphType] ?? '빈칸'
                const prompt = SUMMARY_CARD_PROMPTS[card.paragraphType] ?? '이 문제는'
                const isCorrect = gradingResults[index]
                const isActive = activeCardKey === key

                return (
                  <span key={key} className="flex flex-wrap items-center gap-2">
                    <span>{prompt}</span>
                    <button
                      type="button"
                      onClick={() => setActiveCardKey(key)}
                      className={`inline-flex min-w-[4.5rem] items-center justify-center rounded-xl border-2 px-3 py-2 text-sm font-semibold transition ${
                        isGraded
                          ? isCorrect
                            ? 'bg-info-soft/80 text-info-soft-foreground'
                            : 'bg-danger-soft/80 text-danger-soft-foreground'
                          : hasSelection
                            ? 'border border-muted-foreground/35 bg-background text-foreground'
                            : 'border-dashed border-muted-foreground/40 bg-muted/40 text-neutral-500'
                      } ${isActive && !isGraded ? 'ring-2 ring-info/30' : ''}`}
                    >
                      {selectedChoiceText ?? placeholder}
                    </button>
                  </span>
                )
              })}
              <span>를 구하는 문제이다.</span>
            </div>
          </div>

          {cardEntries.length > 0 ? (
            <div className="mt-4 rounded-2xl bg-background/80 p-4">
              {(() => {
                const activeEntry =
                  cardEntries.find(({ key }) => key === activeCardKey) ?? cardEntries[0]
                const activeCard = activeEntry?.card
                const activeKey = activeEntry?.key
                if (!activeCard) {
                  return null
                }
                const selectedChoiceIndex = selectedChoices[activeKey]
                const label = SUMMARY_CARD_LABELS[activeCard.paragraphType] ?? '빈칸'
                return (
                  <>
                    <p className="text-sm font-semibold text-info-soft-foreground">{label}</p>
                    {activeCard.choices?.length > 0 ? (
                      <div className="mt-3 grid grid-cols-1 gap-2">
                        {activeCard.choices.map((choice, choiceIndex) => {
                          const isSelected = selectedChoiceIndex === choiceIndex
                          return (
                            <button
                              key={`${activeKey}-choice-${choiceIndex}`}
                              className={`min-h-12 rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                                isSelected
                                  ? 'border-2 border-info-soft-foreground bg-background text-foreground'
                                  : 'border-muted-foreground/25 bg-background text-muted-foreground hover:border-muted-foreground/35 hover:text-foreground'
                              }`}
                              disabled={isGraded}
                              onClick={() => handleSelectChoice(activeKey, choiceIndex)}
                              type="button"
                            >
                              {choice}
                            </button>
                          )
                        })}
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-muted-foreground">선택지가 없습니다.</p>
                    )}
                  </>
                )
              })()}
            </div>
          ) : null}
        </div>
        {summaryCards.length === 0 ? (
          <p className="text-sm text-muted-foreground">요약 카드 데이터가 없습니다.</p>
        ) : null}
      </div>

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
