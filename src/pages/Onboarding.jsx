import { useMemo, useState } from 'react'

import { api } from '@/lib/api'
import StatusMessage from '@/components/StatusMessage'
import { refreshAccessToken } from '@/lib/auth'

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

const optionMarks = ['A', 'B', 'C', 'D', 'E']

export default function Onboarding() {
  const [stepIndex, setStepIndex] = useState(0)
  const [answers, setAnswers] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [isResultImageMissing, setIsResultImageMissing] = useState(false)

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
      await refreshAccessToken()
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('codoc_help_auto_shown')
      }
      window.location.replace('/problems/1')
    } catch {
      setSubmitError('설문 저장에 실패했습니다. 잠시 후 다시 시도해주세요.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f8fc] text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col justify-center px-5 py-6 sm:px-6">
        {!isResult ? (
          <>
            <section className="rounded-[26px] border border-[#dbe6f3] bg-white p-4 shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
              <div className="flex items-center justify-between">
                <span className="rounded-full border border-[#d7e2f0] bg-[#f3f8ff] px-3 py-1 text-[11px] font-semibold text-[#4e7cb4]">
                  QUIZ MODE
                </span>
                <span className="text-[12px] font-semibold text-muted-foreground">
                  {stepIndex + 1} / {steps.length}
                </span>
              </div>

              <div className="mt-3 space-y-1.5">
                <div className="h-2 w-full overflow-hidden rounded-full bg-[#e8edf4]">
                  <div
                    className="h-full rounded-full bg-[linear-gradient(90deg,#5f97d6_0%,#7cb0e8_100%)] transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-right text-[11px] font-semibold text-[#6b7280]">
                  {progress}% 완료
                </p>
              </div>

              <div className="mt-4 min-h-[106px] rounded-2xl border border-[#e1e8f2] bg-[#f7faff] px-4 py-3.5 text-left">
                <p className="text-[11px] font-semibold tracking-wide text-[#6482aa]">
                  QUESTION {stepIndex + 1}
                </p>
                <h1
                  className="mt-1 text-[17px] font-semibold leading-tight text-[#0f172a] truncate"
                  title={current.title}
                >
                  {current.title}
                </h1>
                <p className="mt-1.5 text-[12px] text-[#64748b]">
                  가장 가까운 답변 하나를 선택해주세요
                </p>
              </div>

              <div className="mt-8 min-h-[208px] space-y-2">
                {current.options.map((option, idx) => {
                  const selected = answers[current.id] === option
                  return (
                    <button
                      key={option}
                      className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${
                        selected
                          ? 'border-[#7da6d8] bg-[#e9f2ff] text-[#173a63]'
                          : 'border-[#dbe4f0] bg-white text-[#1f2937] hover:border-[#b9cde4] hover:bg-[#f8fbff]'
                      }`}
                      type="button"
                      onClick={() => handleSelect(option)}
                    >
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold ${
                          selected ? 'bg-[#5f97d6] text-white' : 'bg-[#edf2f8] text-[#607284]'
                        }`}
                      >
                        {optionMarks[idx] ?? idx + 1}
                      </span>
                      <span className="min-w-0 flex-1">{option}</span>
                      <span
                        className={`text-sm font-bold ${selected ? 'text-[#4e7cb4]' : 'text-[#b0bac7]'}`}
                        aria-hidden
                      >
                        {selected ? '●' : '○'}
                      </span>
                    </button>
                  )
                })}
              </div>

              <div className="mt-4 h-8 flex justify-start">
                {stepIndex > 0 ? (
                  <button
                    className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[13px] font-semibold text-[#5e6e80] transition hover:bg-[#f2f6fb]"
                    type="button"
                    onClick={handlePrev}
                  >
                    <span aria-hidden>←</span>
                    이전 질문
                  </button>
                ) : (
                  <span aria-hidden className="inline-block h-8" />
                )}
              </div>
            </section>

            <div className="mt-4">
              <button
                className="w-full rounded-2xl bg-[linear-gradient(90deg,#4f86c6_0%,#6a9fd9_100%)] px-4 py-3.5 text-sm font-semibold text-white shadow-[0_10px_20px_rgba(79,134,198,0.28)] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!canMoveNext}
                type="button"
                onClick={handleNext}
              >
                {stepIndex === steps.length - 1 ? '결과 보기' : '다음 질문으로'}
              </button>
            </div>
          </>
        ) : (
          <section className="rounded-[26px] border border-[#dbe6f3] bg-white p-5 shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
            <div className="flex justify-center">
              {!isResultImageMissing ? (
                <img
                  alt="온보딩 완료 이미지"
                  className="h-40 w-40 object-contain mix-blend-multiply"
                  src="https://images.codoc.cloud/images/onboarding.png"
                  onError={() => setIsResultImageMissing(true)}
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#e9f2ff] text-2xl">
                  ✓
                </div>
              )}
            </div>
            <div className="mt-0 space-y-0 text-center">
              <p className="text-base font-semibold">설문 조사 완료!</p>
              <p className="text-sm text-muted-foreground">코독이 첫 학습 설정을 준비했어요</p>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2.5">
              <div className="rounded-2xl border border-[#dbe4f0] bg-[#f7faff] px-4 py-3 text-left">
                <p className="text-[11px] font-semibold text-[#6b7280]">시작 레벨</p>
                <p className="mt-1 text-[18px] font-semibold text-[#0f172a]">
                  {resultSummary?.levelLabel ?? '-'}
                </p>
              </div>
              <div className="rounded-2xl border border-[#dbe4f0] bg-[#f7faff] px-4 py-3 text-left">
                <p className="text-[11px] font-semibold text-[#6b7280]">하루 목표</p>
                <p className="mt-1 text-[18px] font-semibold text-[#0f172a]">
                  {resultSummary?.goalLabel ?? '-'}
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-[#c2d8f2] bg-[linear-gradient(135deg,#dcebfc_0%,#edf5ff_100%)] px-4 py-3.5 text-left shadow-[0_8px_16px_rgba(118,154,198,0.15)]">
              <p className="text-[13px] font-bold text-[#335f90]">코독 추천 시작 전략</p>
              <p className="mt-1.5 text-[13px] font-semibold leading-relaxed text-[#3b5573]">
                기초 문제부터 꾸준히 풀며 학습 리듬을 먼저 만들어보세요.
              </p>
            </div>

            {submitError ? (
              <StatusMessage className="mt-4 text-center" tone="error">
                {submitError}
              </StatusMessage>
            ) : null}

            <div className="mt-5 space-y-3">
              <button
                className="w-full rounded-2xl border border-[#d2dbe7] bg-white px-4 py-3 text-sm font-semibold text-[#334155]"
                type="button"
                onClick={() => {
                  setAnswers({})
                  setStepIndex(0)
                  setSubmitError('')
                }}
              >
                다시 하기
              </button>
              <button
                className="w-full rounded-2xl bg-[linear-gradient(90deg,#4f86c6_0%,#6a9fd9_100%)] px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_20px_rgba(79,134,198,0.28)] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!payload || isSubmitting}
                type="button"
                onClick={handleSubmit}
              >
                {isSubmitting ? '저장 중...' : '코테 공부 시작하기'}
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
