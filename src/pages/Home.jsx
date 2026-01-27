import { useEffect, useMemo, useState } from 'react'

import { api } from '@/lib/api'

const heatmapWeeks = 28
const heatmapRows = 7
const heatmapDays = heatmapWeeks * heatmapRows

const levelClasses = [
  'bg-[#ebedf0]',
  'bg-[#d6f5d6]',
  'bg-[#b7ecb7]',
  'bg-[#8ddb8d]',
  'bg-[#57c957]',
  'bg-[#2ea043]',
]

const statusCopy = {
  IN_PROGRESS: { action: '진행 중', variant: 'claim', disabled: true },
  COMPLETED: { action: '경험치 획득', variant: 'claim', disabled: false },
  CLAIMED: { action: '획득 완료', variant: 'done', disabled: true },
}

const formatDate = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const addDays = (date, days) => {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

const buildHeatmapCells = (dailySolveCount) => {
  const today = new Date()
  const startDate = addDays(today, -(heatmapDays - 1))
  const countByDate = new Map(
    (dailySolveCount ?? []).map((item) => [String(item.date), item.solveCount]),
  )

  return Array.from({ length: heatmapDays }, (_, idx) => {
    const date = addDays(startDate, idx)
    const key = formatDate(date)
    const solveCount = countByDate.get(key) ?? 0
    const level = Math.min(5, Math.max(0, solveCount))
    return { id: key, level }
  })
}

function QuestCard({ quest, onClaim }) {
  const isDone = quest.variant === 'done'
  return (
    <article className="flex min-h-[190px] flex-col justify-between rounded-[24px] border border-black/10 bg-white/95 p-4 shadow-[0_14px_28px_rgba(15,23,42,0.08)]">
      <div className="space-y-4">
        <div
          className={`flex h-16 w-16 items-center justify-center rounded-full border-2 transition ${
            isDone ? 'border-[#3f3f46] bg-[#e5e7eb]' : 'border-[#bfc3c9] bg-[#f4f5f7]'
          }`}
        >
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-full border text-xl font-semibold ${
              isDone
                ? 'border-[#3f3f46] bg-white text-[#3f3f46]'
                : 'border-dashed border-[#9ca3af] text-[#9ca3af]'
            }`}
          >
            {isDone ? '✓' : '•'}
          </div>
        </div>
        <p className="text-sm font-semibold leading-snug">{quest.title}</p>
      </div>
      <button
        className={`mt-6 w-full rounded-xl px-3 py-2 text-xs font-semibold transition ${
          isDone
            ? 'bg-[#e5e7eb] text-[#6b7280]'
            : 'border border-black/10 bg-white text-foreground hover:bg-[#f3f4f6]'
        } disabled:cursor-not-allowed disabled:opacity-60`}
        disabled={quest.disabled}
        type="button"
        onClick={() => onClaim(quest.userQuestId)}
      >
        {quest.action}
      </button>
    </article>
  )
}

export default function Home() {
  const [quests, setQuests] = useState([])
  const [dailySolveCount, setDailySolveCount] = useState([])
  const [streak, setStreak] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let mounted = true

    const fetchHome = async () => {
      setIsLoading(true)
      setLoadError('')

      const today = new Date()
      const fromDate = formatDate(addDays(today, -(heatmapDays - 1)))
      const toDate = formatDate(today)

      try {
        const [questRes, contributionRes, streakRes] = await Promise.all([
          api.get('/api/user/quests'),
          api.get('/api/user/contribution', {
            params: { from_date: fromDate, to_date: toDate },
          }),
          api.get('/api/user/streak'),
        ])

        if (!mounted) {
          return
        }

        const questItems = questRes.data?.data?.quests ?? []
        const mappedQuests = questItems.slice(0, 3).map((item) => {
          const statusMeta = statusCopy[item.status] ?? statusCopy.IN_PROGRESS
          return {
            userQuestId: item.userQuestId,
            title: item.title,
            action: statusMeta.action,
            variant: statusMeta.variant,
            disabled: statusMeta.disabled,
          }
        })

        setQuests(mappedQuests)
        setDailySolveCount(contributionRes.data?.data?.dailySolveCount ?? [])
        setStreak(streakRes.data?.data?.streak ?? 0)
      } catch {
        if (!mounted) {
          return
        }
        setLoadError('홈 데이터를 불러오지 못했습니다.')
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    fetchHome()

    return () => {
      mounted = false
    }
  }, [])

  const heatmapCells = useMemo(() => buildHeatmapCells(dailySolveCount), [dailySolveCount])

  const handleClaim = async (userQuestId) => {
    if (!userQuestId) {
      return
    }
    try {
      await api.post(`/api/user/quests/${userQuestId}`)
      window.location.reload()
    } catch {
      setLoadError('보상 수령에 실패했습니다. 잠시 후 다시 시도해주세요.')
    }
  }

  const questItems =
    quests.length > 0
      ? quests
      : [
          {
            userQuestId: null,
            title: '퀘스트를 준비 중입니다',
            action: '잠시만요',
            variant: 'claim',
            disabled: true,
          },
          {
            userQuestId: null,
            title: '곧 새로운 퀘스트가 도착해요',
            action: '잠시만요',
            variant: 'claim',
            disabled: true,
          },
          {
            userQuestId: null,
            title: '조금만 기다려주세요',
            action: '잠시만요',
            variant: 'claim',
            disabled: true,
          },
        ]

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[28px] border border-black/5 bg-gradient-to-br from-[#fff7e8] via-[#ffffff] to-[#eaf4ff] p-5 shadow-[0_18px_40px_rgba(15,23,42,0.10)]">
        <div className="pointer-events-none absolute -right-16 -top-12 h-40 w-40 rounded-full bg-[#ffd89e] opacity-60 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-10 h-44 w-44 rounded-full bg-[#b9dcff] opacity-60 blur-3xl" />
        <div className="relative space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">오늘의 퀘스트</h2>
            <span className="rounded-full bg-black/5 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
              {quests.filter((q) => q.variant === 'done').length} / {questItems.length}
            </span>
          </div>
          {loadError ? <p className="text-xs font-semibold text-red-500">{loadError}</p> : null}
          <div className="grid grid-cols-3 gap-3">
            {questItems.map((quest) => (
              <QuestCard
                key={`${quest.title}-${quest.userQuestId ?? 'placeholder'}`}
                quest={quest}
                onClaim={handleClaim}
              />
            ))}
          </div>
          {isLoading ? <p className="text-xs text-muted-foreground">불러오는 중...</p> : null}
        </div>
      </section>

      <section className="rounded-[28px] border border-black/10 bg-white p-4 shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">{streak}일 연속 학습</h3>
            <span className="text-xs font-semibold text-muted-foreground">최근 28주</span>
          </div>

          <div className="rounded-2xl bg-[#f6f7f8] p-3">
            <div
              className="grid gap-1"
              style={{ gridTemplateColumns: `repeat(${heatmapWeeks}, minmax(0, 1fr))` }}
            >
              {Array.from({ length: heatmapWeeks }).map((_, colIdx) => (
                <div key={colIdx} className="grid grid-rows-7 gap-1">
                  {Array.from({ length: heatmapRows }).map((_, rowIdx) => {
                    const index = colIdx * heatmapRows + rowIdx
                    const cell = heatmapCells[index]
                    return (
                      <div
                        key={`${colIdx}-${rowIdx}`}
                        className={`aspect-square w-full rounded-[2px] ${levelClasses[cell.level]}`}
                      />
                    )
                  })}
                </div>
              ))}
            </div>

            <div className="mt-3 flex items-center justify-end gap-2 text-[10px] font-semibold text-muted-foreground">
              <span>Less</span>
              <div className="flex items-center gap-1">
                {levelClasses.map((cls) => (
                  <span key={cls} className={`h-2.5 w-2.5 rounded-[2px] ${cls}`} />
                ))}
              </div>
              <span>More</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
