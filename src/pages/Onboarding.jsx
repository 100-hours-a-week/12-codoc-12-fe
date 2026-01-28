import { useMemo, useState } from 'react'

import { api } from '@/lib/api'
import StatusMessage from '@/components/StatusMessage'
import { clearAccessToken } from '@/lib/auth'

const steps = [
  {
    id: 'experience',
    title: '코딩 테스트 문제를 풀어본 적이 있나요?',
    options: ['한 번도 없다', '몇 문제 풀어봤다', '꾸준히 풀고 있다'],
  },
  {
    id: 'level',
    title: '알고리즘 공부를 해본 적 있나요?',
    options: ['없다', '개념만 들어봤다 (정렬, 탐색 등)', '문제로 연습해봤다'],
  },
  {
    id: 'blocker',
    title: '코테 문제를 보면 보통 어디서 막히나요?',
    options: [
      '문제 이해부터 어렵다',
      '어떤 알고리즘을 써야 할지 모르겠다',
      '코드로 옮기는 과정이 어렵다',
      '잘 모르겠다',
    ],
  },
  {
    id: 'pace',
    title: '하루에 얼마나 공부하고 싶나요?',
    options: ['한 문제', '세 문제', '다섯 문제 이상'],
  },
]

const initLevelMap = {
  없다: 'NEWBIE',
  '개념만 들어봤다 (정렬, 탐색 등)': 'PUPIL',
  '문제로 연습해봤다': 'SPECIALIST',
}

const dailyGoalMap = {
  '한 문제': 'ONE',
  '세 문제': 'THREE',
  '다섯 문제 이상': 'FIVE',
}

const levelLabelMap = {
  NEWBIE: '초보자',
  PUPIL: '입문자',
  SPECIALIST: '숙련자',
}

const goalLabelMap = {
  ONE: '한 문제',
  THREE: '세 문제',
  FIVE: '다섯 문제 이상',
}

export default function Onboarding() {
  const [stepIndex, setStepIndex] = useState(0)
  const [answers, setAnswers] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const isResult = stepIndex >= steps.length
  const current = steps[stepIndex]

  const progress = useMemo(() => {
    if (isResult) {
      return 100
    }
    return Math.round(((stepIndex + 1) / steps.length) * 100)
  }, [isResult, stepIndex])

  const payload = useMemo(() => {
    const initLevel = initLevelMap[answers.level]
    const dailyGoal = dailyGoalMap[answers.pace]
    if (!initLevel || !dailyGoal) {
      return null
    }
    return { initLevel, dailyGoal }
  }, [answers.level, answers.pace])

  const resultSummary = useMemo(() => {
    if (!payload) {
      return null
    }
    return {
      levelLabel: levelLabelMap[payload.initLevel],
      goalLabel: goalLabelMap[payload.dailyGoal],
    }
  }, [payload])

  const handleSelect = (option) => {
    if (!current) {
      return
    }
    setAnswers((prev) => ({ ...prev, [current.id]: option }))
    setSubmitError('')
  }

  const canMoveNext = isResult || Boolean(answers[current?.id])

  const handleNext = () => {
    if (isResult || !canMoveNext) {
      return
    }
    setStepIndex((prev) => Math.min(prev + 1, steps.length))
  }

  const handlePrev = () => {
    setStepIndex((prev) => Math.max(prev - 1, 0))
  }

  const handleSubmit = async () => {
    if (!payload || isSubmitting) {
      setSubmitError('설문 답변을 모두 완료해주세요.')
      return
    }

    setIsSubmitting(true)
    setSubmitError('')
    try {
      await api.patch('/api/user/init-survey', payload)
      clearAccessToken()
      window.location.replace('/')
    } catch {
      setSubmitError('설문 저장에 실패했습니다. 잠시 후 다시 시도해주세요.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f4f5f7] text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col px-5 py-10 sm:px-6">
        <div className="rounded-[28px] bg-[#eef0f2] px-5 pb-8 pt-6 shadow-sm">
          {!isResult ? (
            <div className="space-y-8">
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm font-semibold">
                  <span>
                    질문 {stepIndex + 1} / {steps.length}
                  </span>
                  <span>{progress}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-[#d9dadd]">
                  <div
                    className="h-full rounded-full bg-[#7b7d82] transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              <div className="flex justify-start">
                <div className="h-20 w-20 rounded-full bg-[#e2e3e6]" />
              </div>

              <div className="space-y-6">
                <h1 className="text-lg font-semibold leading-snug">{current.title}</h1>
                <div className="space-y-3">
                  {current.options.map((option) => {
                    const selected = answers[current.id] === option
                    return (
                      <button
                        key={option}
                        className={`w-full rounded-2xl px-4 py-4 text-left text-sm font-medium transition ${
                          selected
                            ? 'bg-[#7b7d82] text-white'
                            : 'bg-[#d7d8da] text-foreground hover:bg-[#cfd1d4]'
                        }`}
                        type="button"
                        onClick={() => handleSelect(option)}
                      >
                        {option}
                      </button>
                    )
                  })}
                </div>
              </div>

              {stepIndex > 0 ? (
                <button
                  className="inline-flex items-center gap-1 text-sm font-medium text-foreground/80"
                  type="button"
                  onClick={handlePrev}
                >
                  <span aria-hidden>←</span>
                  이전 질문
                </button>
              ) : null}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex justify-center">
                <div className="h-20 w-20 rounded-2xl bg-[#7b7d82]" />
              </div>
              <div className="space-y-1 text-center">
                <p className="text-base font-semibold">설문 완료!</p>
                <p className="text-sm text-muted-foreground">당신의 레벨을 분석했습니다</p>
              </div>
              <div className="rounded-3xl bg-[#d7d8da] px-4 py-6 text-center">
                <p className="text-sm text-foreground/80">당신은</p>
                <p className="mt-1 text-xl font-semibold">{resultSummary?.levelLabel ?? '-'}</p>
                <p className="mt-3 text-sm text-foreground/80">기초부터 차근차근 시작해보세요!</p>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-[#e2e3e6] px-4 py-3 text-sm font-semibold">
                <span>하루 목표</span>
                <span>{resultSummary?.goalLabel ?? '-'}</span>
              </div>
              {submitError ? (
                <StatusMessage className="text-center" tone="error">
                  {submitError}
                </StatusMessage>
              ) : null}
              <div className="space-y-3 pt-2">
                <button
                  className="w-full rounded-2xl bg-[#cfd1d4] px-4 py-3 text-sm font-semibold"
                  type="button"
                  onClick={() => {
                    setStepIndex(0)
                    setSubmitError('')
                  }}
                >
                  다시 하기
                </button>
                <button
                  className="w-full rounded-2xl bg-foreground px-4 py-3 text-sm font-semibold text-background disabled:opacity-60"
                  disabled={!payload || isSubmitting}
                  type="button"
                  onClick={handleSubmit}
                >
                  {isSubmitting ? '저장 중...' : '코테 공부 시작하기'}
                </button>
              </div>
            </div>
          )}
        </div>

        {!isResult ? (
          <div className="mt-6">
            <button
              className="w-full rounded-2xl bg-foreground px-4 py-3 text-sm font-semibold text-background disabled:opacity-60"
              disabled={!canMoveNext}
              type="button"
              onClick={handleNext}
            >
              {stepIndex === steps.length - 1 ? '결과 보기' : '다음'}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
