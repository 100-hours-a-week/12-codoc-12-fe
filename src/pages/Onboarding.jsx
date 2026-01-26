import { useMemo, useState } from 'react'

import { api } from '@/lib/api'
import { clearAccessToken } from '@/lib/auth'

const steps = [
  {
    id: 'goal',
    title: '당신의 목표를 알려주세요',
    prompt: '코딩 학습에서 가장 바라는 한 가지를 고르면, 맞춤 퀘스트를 추천해요.',
    options: ['문제 풀이 습관 만들기', '개념을 빠르게 정리하기', '면접 대비', '프로젝트 실전 감각'],
  },
  {
    id: 'level',
    title: '현재 레벨은 어느 정도인가요?',
    prompt: '난이도 조정을 위해 현재 수준을 선택해주세요.',
    options: ['입문', '초급', '중급', '고급'],
  },
  {
    id: 'topic',
    title: '관심 있는 분야를 골라주세요',
    prompt: '초기에 집중하고 싶은 영역을 1개만 선택해도 좋아요.',
    options: ['알고리즘', '자료구조', '프론트엔드', '백엔드'],
  },
  {
    id: 'pace',
    title: '하루 목표는 얼마나?',
    prompt: '매일 달성할 학습량을 정하면 루틴을 만들기 쉬워요.',
    options: ['가볍게 10분', '30분 집중', '1시간 이상', '주말 몰아서'],
  },
]

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

  const handleSelect = (option) => {
    if (!current) {
      return
    }
    setAnswers((prev) => ({ ...prev, [current.id]: option }))
    setSubmitError('')
  }

  const canMoveNext = isResult || Boolean(answers[current?.id])

  const payload = useMemo(() => {
    const initLevelMap = {
      입문: 'NEWBIE',
      초급: 'PUPIL',
      중급: 'PUPIL',
      고급: 'SPECIALIST',
    }
    const dailyGoalMap = {
      '가볍게 10분': 'ONE',
      '30분 집중': 'THREE',
      '1시간 이상': 'FIVE',
      '주말 몰아서': 'THREE',
    }
    const initLevel = initLevelMap[answers.level]
    const dailyGoal = dailyGoalMap[answers.pace]

    if (!initLevel || !dailyGoal) {
      return null
    }

    return { initLevel, dailyGoal }
  }, [answers.level, answers.pace])

  const handleNext = () => {
    if (isResult) {
      return
    }
    if (!canMoveNext) {
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
    <div className="relative min-h-screen bg-[#f6f3ea] text-foreground">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-24 -top-32 h-72 w-72 rounded-full bg-[#ffe5b4] opacity-70 blur-3xl" />
        <div className="absolute -bottom-28 -right-16 h-80 w-80 rounded-full bg-[#cfe9ff] opacity-70 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-[480px] flex-col justify-between px-5 py-10 sm:px-6">
        <div className="space-y-8">
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">
              Codoc Onboarding
            </p>
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl font-[var(--font-display)]">
                너의 학습 루틴을 설계할게요
              </h1>
              <p className="text-sm text-muted-foreground">
                몇 가지 질문에 답하면, 오늘부터 시작할 코독의 퀘스트가 완성됩니다.
              </p>
            </div>
          </div>

          <div className="rounded-3xl border border-foreground/10 bg-white/90 p-6 shadow-sm backdrop-blur">
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>진행률</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-foreground transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              {!isResult ? (
                <div className="space-y-5">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      Step {stepIndex + 1} / {steps.length}
                    </p>
                    <h2 className="text-xl font-semibold font-[var(--font-display)]">
                      {current.title}
                    </h2>
                    <p className="text-sm text-muted-foreground">{current.prompt}</p>
                  </div>

                  <div className="grid gap-3">
                    {current.options.map((option) => {
                      const selected = answers[current.id] === option
                      return (
                        <button
                          key={option}
                          className={`flex w-full items-center justify-between rounded-2xl border px-4 py-4 text-left text-sm font-medium transition ${
                            selected
                              ? 'border-foreground bg-foreground text-background shadow-sm'
                              : 'border-foreground/10 bg-white hover:border-foreground/40'
                          }`}
                          type="button"
                          onClick={() => handleSelect(option)}
                        >
                          <span>{option}</span>
                          <span className="text-xs opacity-70">{selected ? '선택됨' : '선택'}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <h2 className="text-xl font-semibold font-[var(--font-display)]">
                    설문이 준비됐어요
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    곧 퀘스트 추천을 시작할게요. 아래 선택 내용을 확인해 주세요.
                  </p>
                  <div className="grid gap-3 text-sm">
                    {steps.map((step) => (
                      <div
                        key={step.id}
                        className="rounded-2xl border border-foreground/10 bg-white px-4 py-3"
                      >
                        <p className="text-xs text-muted-foreground">{step.title}</p>
                        <p className="font-medium">{answers[step.id]}</p>
                      </div>
                    ))}
                  </div>
                  {submitError ? <p className="text-xs text-red-500">{submitError}</p> : null}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-8 flex items-center justify-between gap-3">
          <button
            className="rounded-full border border-foreground/30 px-4 py-2 text-sm font-medium text-foreground/80 transition hover:border-foreground"
            disabled={stepIndex === 0}
            type="button"
            onClick={handlePrev}
          >
            이전
          </button>
          <button
            className="rounded-full bg-foreground px-6 py-2 text-sm font-semibold text-background transition hover:opacity-90 disabled:opacity-50"
            disabled={isResult ? !payload || isSubmitting : !canMoveNext}
            type="button"
            onClick={isResult ? handleSubmit : handleNext}
          >
            {isResult
              ? isSubmitting
                ? '저장 중...'
                : '설문 저장하기'
              : stepIndex === steps.length - 1
                ? '결과 보기'
                : '다음'}
          </button>
        </div>
      </div>
    </div>
  )
}
