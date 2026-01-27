import { useEffect, useMemo, useRef, useState } from 'react'

import { api } from '@/lib/api'

const heatmapRows = 7
const heatmapCellPx = 16
const heatmapGapPx = 4
const colWidthPx = heatmapCellPx + heatmapGapPx
const rootPaddingPx = 12
const heatmapPaddingPx = 8
const tooltipOffsetPx = 6
const tooltipHeightPx = 36

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

const daysBetween = (from, to) => Math.floor((to - from) / 86400000)

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

function Heatmap({ model, monthMarkers, scrollRef, selectedCell, onSelectCell, streak }) {
  const [tooltipLeft, setTooltipLeft] = useState(rootPaddingPx)
  const [tooltipTop, setTooltipTop] = useState(heatmapPaddingPx)
  const rootRef = useRef(null)

  useEffect(() => {
    const container = scrollRef.current
    const root = rootRef.current
    if (!container || !root || !selectedCell?.date) {
      return
    }
    const cellEl = root.querySelector(`[data-date="${selectedCell.date}"]`)
    const rootRect = root.getBoundingClientRect()
    const cellRect = cellEl?.getBoundingClientRect()

    const minLeft = rootPaddingPx
    const maxLeft = Math.max(minLeft, root.clientWidth - 180 - rootPaddingPx)

    if (cellRect) {
      const cellCenterLeft = cellRect.left - rootRect.left + heatmapCellPx / 2
      const rawLeft = cellCenterLeft - 90
      const nextLeft = Math.min(maxLeft, Math.max(minLeft, rawLeft))
      setTooltipLeft(nextLeft)

      const rawTop = cellRect.top - rootRect.top + heatmapCellPx + tooltipOffsetPx
      const maxTop = Math.max(heatmapPaddingPx, root.clientHeight - tooltipHeightPx - rootPaddingPx)
      setTooltipTop(Math.min(maxTop, Math.max(heatmapPaddingPx, rawTop)))
      return
    }

    const fallbackLeft = selectedCell.colIdx * colWidthPx - container.scrollLeft
    const nextLeft = Math.min(maxLeft, Math.max(minLeft, rootPaddingPx + fallbackLeft))
    setTooltipLeft(nextLeft)

    const rowTop = selectedCell.rowIdx * (heatmapCellPx + heatmapGapPx)
    const nextTop = heatmapPaddingPx + rowTop + heatmapCellPx + tooltipOffsetPx
    const maxTop = Math.max(heatmapPaddingPx, root.clientHeight - tooltipHeightPx - rootPaddingPx)
    setTooltipTop(Math.min(maxTop, nextTop))
  }, [scrollRef, selectedCell])

  useEffect(() => {
    if (!selectedCell?.date) {
      return
    }
    const container = scrollRef.current
    const root = rootRef.current
    if (!container || !root) {
      return
    }
    const handleScroll = () => onSelectCell(null)
    const handlePointerDown = (event) => {
      if (!root.contains(event.target)) {
        onSelectCell(null)
      }
    }
    container.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('pointerdown', handlePointerDown)
    return () => {
      container.removeEventListener('scroll', handleScroll)
      window.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [onSelectCell, scrollRef, selectedCell])

  return (
    <div
      ref={rootRef}
      className="relative rounded-[28px] border border-black/10 bg-white p-4 shadow-[0_16px_36px_rgba(15,23,42,0.08)]"
    >
      <div className="space-y-4">
        <div className="flex items-center">
          <h3 className="text-base font-semibold">{streak}일 연속 학습</h3>
        </div>

        <div className="rounded-2xl bg-[#f6f7f8] p-3">
          <div ref={scrollRef} className="overflow-x-auto pb-1">
            <div className="relative" style={{ minWidth: `${model.minWidthPx}px` }}>
              <div
                className="grid gap-1"
                style={{
                  gridTemplateColumns: `repeat(${model.weeks}, ${heatmapCellPx}px)`,
                }}
              >
                {Array.from({ length: model.weeks }).map((_, colIdx) => (
                  <div key={colIdx} className="grid grid-rows-7 gap-1">
                    {Array.from({ length: heatmapRows }).map((_, rowIdx) => {
                      const index = colIdx * heatmapRows + rowIdx
                      const cell = model.cells[index]
                      return (
                        <div
                          key={`${colIdx}-${rowIdx}`}
                          className={`h-4 w-4 rounded-[2px] ${levelClasses[cell.level]} ${
                            cell.date && selectedCell?.date === cell.date
                              ? 'ring-2 ring-black/70'
                              : ''
                          }`}
                          data-date={cell.date ?? undefined}
                          role={cell.date ? 'button' : undefined}
                          tabIndex={cell.date ? 0 : undefined}
                          onClick={() => {
                            if (!cell.date) {
                              return
                            }
                            if (selectedCell?.date === cell.date) {
                              onSelectCell(null)
                              return
                            }
                            onSelectCell({ ...cell, colIdx, rowIdx })
                          }}
                          onKeyDown={(event) => {
                            if (cell.date && (event.key === 'Enter' || event.key === ' ')) {
                              event.preventDefault()
                              onSelectCell({ ...cell, colIdx, rowIdx })
                            }
                          }}
                        />
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
            <div className="relative mt-2 h-6" style={{ minWidth: `${model.minWidthPx}px` }}>
              {monthMarkers.map((marker) => (
                <div
                  key={marker.key}
                  className="absolute top-0 text-[10px] font-semibold text-muted-foreground"
                  style={{ left: `${marker.leftPx}px` }}
                >
                  <div className="h-2 border-l border-black/20" />
                  <div className="mt-1 -translate-x-1">{marker.label}</div>
                </div>
              ))}
            </div>
          </div>
          {selectedCell?.date ? (
            <div
              className="pointer-events-none absolute z-20 rounded-lg bg-black px-3 py-2 text-xs font-semibold text-white shadow-lg"
              style={{ left: `${tooltipLeft}px`, top: `${tooltipTop}px` }}
            >
              {selectedCell.date} : {selectedCell.solveCount}문제 해결
            </div>
          ) : null}

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
    </div>
  )
}

export default function Home() {
  const [quests, setQuests] = useState([])
  const [dailySolveCount, setDailySolveCount] = useState([])
  const [streak, setStreak] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const heatmapScrollRef = useRef(null)
  const [selectedCell, setSelectedCell] = useState(null)

  const today = useMemo(() => new Date(), [])
  const contributionRange = useMemo(() => getContributionRange(today), [today])
  const monthMarkers = useMemo(() => buildMonthMarkers(contributionRange), [contributionRange])

  useEffect(() => {
    let mounted = true

    const fetchHome = async () => {
      setIsLoading(true)
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
        setSelectedCell(null)
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
  }, [contributionRange.fromDate, contributionRange.toDate])

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

      <Heatmap
        model={heatmapModel}
        monthMarkers={monthMarkers}
        scrollRef={heatmapScrollRef}
        selectedCell={selectedCell}
        onSelectCell={setSelectedCell}
        streak={streak}
      />
    </div>
  )
}
