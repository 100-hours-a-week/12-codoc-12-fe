import { RefreshCw } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import Heatmap, { HEATMAP_COL_WIDTH_PX, HEATMAP_ROWS } from '@/components/Heatmap'
import { api } from '@/lib/api'
import StatusMessage from '@/components/StatusMessage'

const heatmapRows = HEATMAP_ROWS
const colWidthPx = HEATMAP_COL_WIDTH_PX

const monthNames = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

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

const formatDate = (date) => date.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })

const addDays = (date, days) => {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

const daysBetween = (from, to) => Math.floor((to - from) / 86400000)

const getKstToday = () => {
  const now = new Date()
  const kstDate = now.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
  return new Date(`${kstDate}T00:00:00+09:00`)
}

const getContributionRange = (today) => {
  const fromDate = addDays(today, -364)
  return { fromDate, toDate: today, today }
}

const buildMonthMarkers = (range) => {
  const markers = []
  const cursor = new Date(range.fromDate.getFullYear(), range.fromDate.getMonth(), 1)

  while (cursor < range.fromDate) {
    cursor.setMonth(cursor.getMonth() + 1)
  }

  while (cursor <= range.toDate) {
    const dayIndex = daysBetween(range.fromDate, cursor)
    const colIndex = Math.floor(dayIndex / heatmapRows)
    markers.push({
      key: formatDate(cursor),
      label: monthNames[cursor.getMonth()],
      leftPx: colIndex * colWidthPx,
    })
    cursor.setMonth(cursor.getMonth() + 1)
  }

  return markers
}

const buildHeatmapModel = (dailySolveCount, range) => {
  const countByDate = new Map(
    (dailySolveCount ?? []).map((item) => [String(item.date), item.solveCount]),
  )
  const totalDays = Math.max(1, daysBetween(range.fromDate, range.toDate) + 1)
  const weeks = Math.ceil(totalDays / heatmapRows)
  const totalCells = weeks * heatmapRows
  const minWidthPx = weeks * colWidthPx

  const cells = Array.from({ length: totalCells }, (_, idx) => {
    if (idx >= totalDays) {
      return { id: `pad-${idx}`, level: 0, date: null, solveCount: 0 }
    }
    const date = addDays(range.fromDate, idx)
    if (date > range.today) {
      return { id: `future-${idx}`, level: 0, date: null, solveCount: 0 }
    }
    const key = formatDate(date)
    const solveCount = countByDate.get(key) ?? 0
    const level = Math.min(5, Math.max(0, solveCount))
    return { id: key, level, date: key, solveCount }
  })

  return { cells, weeks, minWidthPx, startDate: range.fromDate, totalDays }
}

function QuestCard({ quest, onClaim }) {
  const isDone = quest.variant === 'done'
  return (
    <article className="flex min-h-[140px] flex-col justify-between rounded-[16px] border border-black/10 bg-white p-2.5 shadow-[0_6px_12px_rgba(15,23,42,0.06)]">
      <div className="space-y-2.5">
        <div
          className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full border-2 transition ${
            isDone ? 'border-[#3f3f46] bg-[#e5e7eb]' : 'border-[#bfc3c9] bg-[#f4f5f7]'
          }`}
        >
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-full border text-lg font-semibold ${
              isDone
                ? 'border-[#3f3f46] bg-white text-[#3f3f46]'
                : 'border-dashed border-[#9ca3af] text-[#9ca3af]'
            }`}
          >
            {isDone ? '✓' : '•'}
          </div>
        </div>
        <p
          className="text-sm font-semibold leading-snug"
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {quest.title}
        </p>
      </div>
      <button
        className={`mt-4 w-full rounded-xl px-3 py-2 text-xs font-semibold transition ${
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
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [loadError, setLoadError] = useState('')
  const heatmapScrollRef = useRef(null)
  const [selectedCell, setSelectedCell] = useState(null)
  const [questPage, setQuestPage] = useState(0)
  const questTouchStartX = useRef(null)
  const questTouchLastX = useRef(null)

  const today = useMemo(() => getKstToday(), [])
  const contributionRange = useMemo(() => getContributionRange(today), [today])
  const monthMarkers = useMemo(() => buildMonthMarkers(contributionRange), [contributionRange])

  useEffect(() => {
    let mounted = true

    const fetchHome = async (options = {}) => {
      const { showLoading = true } = options
      if (showLoading) {
        setIsLoading(true)
      }
      setLoadError('')

      const fromDate = formatDate(contributionRange.fromDate)
      const toDate = formatDate(contributionRange.toDate)

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
        const mappedQuests = questItems.map((item) => {
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
        setSelectedCell(null)
      } catch {
        if (!mounted) {
          return
        }
        setLoadError('홈 데이터를 불러오지 못했습니다.')
      } finally {
        if (mounted && showLoading) {
          setIsLoading(false)
        }
      }
    }

    fetchHome()

    return () => {
      mounted = false
    }
  }, [contributionRange.fromDate, contributionRange.toDate])

  const handleQuestRefresh = async () => {
    if (isRefreshing) {
      return
    }
    setIsRefreshing(true)
    setLoadError('')
    try {
      await api.post('/api/user/quests/refresh', {})
      const fromDate = formatDate(contributionRange.fromDate)
      const toDate = formatDate(contributionRange.toDate)
      const [questRes, contributionRes, streakRes] = await Promise.all([
        api.get('/api/user/quests'),
        api.get('/api/user/contribution', {
          params: { from_date: fromDate, to_date: toDate },
        }),
        api.get('/api/user/streak'),
      ])
      const questItems = questRes.data?.data?.quests ?? []
      const mappedQuests = questItems.map((item) => {
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
      setSelectedCell(null)
    } catch {
      setLoadError('퀘스트를 새로고침하지 못했습니다. 잠시 후 다시 시도해주세요.')
    } finally {
      setIsRefreshing(false)
    }
  }

  const heatmapModel = useMemo(
    () => buildHeatmapModel(dailySolveCount, contributionRange),
    [contributionRange, dailySolveCount],
  )

  useEffect(() => {
    const container = heatmapScrollRef.current
    if (!container || !heatmapModel?.weeks) {
      return
    }
    const dayIndex = Math.min(
      heatmapModel.totalDays - 1,
      Math.max(0, daysBetween(heatmapModel.startDate, contributionRange.today)),
    )
    const targetCol = Math.floor(dayIndex / heatmapRows)
    const targetLeft = Math.max(0, (targetCol + 1) * colWidthPx - container.clientWidth)
    container.scrollTo({ left: targetLeft, behavior: 'auto' })
  }, [contributionRange.today, heatmapModel])

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
  const questPages = Math.max(1, Math.ceil(questItems.length / 3))
  const isQuestPaged = questItems.length > 3
  const questOffsetPct = Math.min(questPages - 1, questPage) * (100 / questPages)

  return (
    <div className="space-y-6">
      <section className="rounded-[20px] border border-black/5 bg-white p-2.5 shadow-[0_10px_24px_rgba(15,23,42,0.07)]">
        <div className="relative space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isQuestPaged ? (
                <button
                  className="flex h-6 w-6 items-center justify-center text-lg font-semibold text-black disabled:cursor-not-allowed disabled:opacity-30"
                  type="button"
                  onClick={() => setQuestPage((prev) => Math.max(0, prev - 1))}
                  disabled={questPage === 0}
                  aria-label="이전 퀘스트"
                >
                  ‹
                </button>
              ) : null}
              <h2 className="text-lg font-semibold">오늘의 퀘스트</h2>
              {isQuestPaged ? (
                <button
                  className="flex h-6 w-6 items-center justify-center text-lg font-semibold text-black disabled:cursor-not-allowed disabled:opacity-30"
                  type="button"
                  onClick={() => setQuestPage((prev) => Math.min(questPages - 1, prev + 1))}
                  disabled={questPage >= questPages - 1}
                  aria-label="다음 퀘스트"
                >
                  ›
                </button>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <button
                className="flex h-7 w-7 items-center justify-center rounded-full border border-black/10 text-xs text-muted-foreground disabled:opacity-40"
                type="button"
                onClick={handleQuestRefresh}
                disabled={isRefreshing}
                aria-label="퀘스트 새로고침"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
              <span className="rounded-full bg-black/5 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                {quests.filter((q) => q.variant === 'done').length} / {questItems.length}
              </span>
            </div>
          </div>
          {loadError ? <StatusMessage tone="error">{loadError}</StatusMessage> : null}
          <div className="relative">
            <div
              className="overflow-hidden"
              style={{ touchAction: 'pan-y' }}
              onTouchStart={(event) => {
                if (!isQuestPaged) {
                  return
                }
                const startX = event.touches[0]?.clientX ?? null
                questTouchStartX.current = startX
                questTouchLastX.current = startX
              }}
              onTouchMove={(event) => {
                if (!isQuestPaged) {
                  return
                }
                questTouchLastX.current = event.touches[0]?.clientX ?? questTouchLastX.current
              }}
              onTouchEnd={(event) => {
                if (!isQuestPaged || questTouchStartX.current == null) {
                  return
                }
                const endX = questTouchLastX.current ?? event.changedTouches[0]?.clientX ?? null
                if (endX == null) {
                  questTouchStartX.current = null
                  questTouchLastX.current = null
                  return
                }
                const delta = questTouchStartX.current - endX
                questTouchStartX.current = null
                questTouchLastX.current = null
                if (Math.abs(delta) < 40) {
                  return
                }
                if (delta > 0) {
                  setQuestPage((prev) => Math.min(questPages - 1, prev + 1))
                } else {
                  setQuestPage((prev) => Math.max(0, prev - 1))
                }
              }}
              onTouchCancel={() => {
                questTouchStartX.current = null
                questTouchLastX.current = null
              }}
            >
              <div
                className="flex w-full transition-transform duration-300 ease-out"
                style={{
                  width: `${questPages * 100}%`,
                  transform: `translateX(-${questOffsetPct}%)`,
                }}
              >
                {Array.from({ length: questPages }).map((_, pageIndex) => {
                  const sliceStart = pageIndex * 3
                  const sliceEnd = sliceStart + 3
                  const pageItems = questItems.slice(sliceStart, sliceEnd)
                  return (
                    <div
                      key={`quest-page-${pageIndex}`}
                      className="grid flex-none grid-cols-3 gap-1 px-0.5"
                      style={{ width: `${100 / questPages}%` }}
                    >
                      {pageItems.map((quest) => (
                        <QuestCard
                          key={`${quest.title}-${quest.userQuestId ?? 'placeholder'}-${pageIndex}`}
                          quest={quest}
                          onClaim={handleClaim}
                        />
                      ))}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
          {isLoading ? <StatusMessage>불러오는 중...</StatusMessage> : null}
        </div>
      </section>

      <Heatmap
        model={heatmapModel}
        monthMarkers={monthMarkers}
        scrollRef={heatmapScrollRef}
        selectedCell={selectedCell}
        onSelectCell={setSelectedCell}
        levelClasses={levelClasses}
        header={<h3 className="text-lg font-semibold">{streak}일 연속 학습</h3>}
        cardClassName="mt-1"
      />
      <div className="mt-3">
        <a
          className="block w-full rounded-xl border border-black/15 bg-white px-4 py-3 text-center text-sm font-semibold text-foreground shadow-sm transition hover:bg-[#f3f4f6]"
          href="https://docs.google.com/forms/d/e/1FAIpQLSd7MbHiijJHphq767m1eeHmpmqqA8XRzcDuG2TljsBKCR3yqQ/viewform?pli=1"
          target="_blank"
          rel="noreferrer"
        >
          개발자 괴롭히기 (사용자 피드백 설문)
        </a>
      </div>
    </div>
  )
}
