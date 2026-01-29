import { useEffect, useMemo, useRef, useState } from 'react'

import StatusMessage from '@/components/StatusMessage'
import { api } from '@/lib/api'
import { clearAccessToken, logout } from '@/lib/auth'

const years = [2023, 2024, 2025, 2026]
const heatmapRows = 7
const heatmapCellPx = 16
const heatmapGapPx = 4
const colWidthPx = heatmapCellPx + heatmapGapPx
const heatmapPaddingPx = 8
const tooltipOffsetPx = 6
const rootPaddingPx = 12

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

const getContributionRange = (year) => {
  const startOfYear = new Date(year, 0, 1)
  const today = getKstToday()
  const isCurrentYear = year === today.getFullYear()
  const endDate = isCurrentYear
    ? new Date(today.getFullYear(), today.getMonth(), today.getDate())
    : new Date(year, 11, 31)
  return { fromDate: startOfYear, toDate: endDate }
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

const buildHeatmapCells = (dailySolveCount, range, cutoffDate = null) => {
  const countByDate = new Map(
    (dailySolveCount ?? []).map((item) => [String(item.date), item.solveCount]),
  )
  const totalDays = Math.max(1, Math.round((range.toDate - range.fromDate) / 86400000) + 1)
  const weeks = Math.ceil(totalDays / heatmapRows)
  const totalCells = weeks * heatmapRows
  const minWidthPx = weeks * colWidthPx

  const cells = Array.from({ length: totalCells }, (_, idx) => {
    if (idx >= totalDays) {
      return { id: `pad-${idx}`, level: 0, date: null, solveCount: 0 }
    }
    const date = addDays(range.fromDate, idx)
    if (cutoffDate && date > cutoffDate) {
      return { id: `future-${idx}`, level: 0, date: null, solveCount: 0 }
    }
    const key = formatDate(date)
    const solveCount = countByDate.get(key) ?? 0
    const level = Math.min(5, Math.max(0, solveCount))
    return { id: key, level, date: key, solveCount }
  })

  return { cells, weeks, minWidthPx, startDate: range.fromDate, totalDays }
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-black/15 bg-white px-3 py-4 text-center shadow-[0_10px_20px_rgba(15,23,42,0.05)]">
      <p className="text-lg font-semibold">{value}</p>
      <p className="mt-1 text-xs font-semibold text-muted-foreground">{label}</p>
    </div>
  )
}

function Heatmap({ model, monthMarkers, scrollRef, onSelectCell, selectedCell }) {
  const [tooltipLeft, setTooltipLeft] = useState(8)
  const [tooltipTop, setTooltipTop] = useState(heatmapPaddingPx)
  const rootRef = useRef(null)

  useEffect(() => {
    const container = scrollRef.current
    const root = rootRef.current
    if (!container || !root || !selectedCell?.date) {
      return
    }
    const rawLeft = selectedCell.colIdx * colWidthPx - container.scrollLeft
    const minLeft = rootPaddingPx
    const maxLeft = Math.max(minLeft, root.clientWidth - 180 - rootPaddingPx)
    const nextLeft = Math.min(maxLeft, Math.max(minLeft, rootPaddingPx + rawLeft))
    setTooltipLeft(nextLeft)
    const gridHeightPx = heatmapRows * heatmapCellPx + (heatmapRows - 1) * heatmapGapPx
    const rowTop = selectedCell.rowIdx * (heatmapCellPx + heatmapGapPx)
    const nextTop = heatmapPaddingPx + rowTop + heatmapCellPx + tooltipOffsetPx
    const maxTop = heatmapPaddingPx + gridHeightPx - 28
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
      className="relative rounded-2xl border border-black/15 bg-white p-3 shadow-[0_12px_24px_rgba(15,23,42,0.06)]"
    >
      <div ref={scrollRef} className="heatmap-scroll overflow-x-scroll pb-1 pr-2">
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
                      className={`h-4 w-4 rounded-[2px] ${
                        cell.date ? levelClasses[cell.level] : 'bg-transparent'
                      } ${cell.date && selectedCell?.date === cell.date ? 'ring-2 ring-black/70' : ''}`}
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
  )
}

export default function MyPage() {
  const [isEditing, setIsEditing] = useState(false)
  const [nickname, setNickname] = useState('코딩 마스터')
  const [draftNickname, setDraftNickname] = useState(nickname)
  const [year, setYear] = useState(getKstToday().getFullYear())
  const [isYearMenuOpen, setIsYearMenuOpen] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [isLoadingProfile, setIsLoadingProfile] = useState(true)
  const [isLoadingStats, setIsLoadingStats] = useState(true)
  const [isLoadingContribution, setIsLoadingContribution] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [avatars, setAvatars] = useState([])
  const [avatarError, setAvatarError] = useState('')
  const [selectedAvatarId, setSelectedAvatarId] = useState(null)
  const [avatarUrl, setAvatarUrl] = useState('')
  const [isAvatarPickerOpen, setIsAvatarPickerOpen] = useState(false)
  const [stats, setStats] = useState({ solvedCount: 0, solvingCount: 0, totalXp: 0 })
  const [dailySolveCount, setDailySolveCount] = useState([])
  const heatmapScrollRef = useRef(null)
  const [selectedCell, setSelectedCell] = useState(null)

  const helperText = useMemo(() => '2자 이상 15자 이하 입력 (공백, 특수문자, 비속어 제외)', [])

  const contributionRange = useMemo(() => getContributionRange(year), [year])
  const monthMarkers = useMemo(() => buildMonthMarkers(contributionRange), [contributionRange])

  const heatmapModel = useMemo(() => {
    const today = getKstToday()
    const isCurrentYear = year === today.getFullYear()
    const cutoffDate = isCurrentYear ? today : null
    return buildHeatmapCells(dailySolveCount, contributionRange, cutoffDate)
  }, [contributionRange, dailySolveCount, year])

  useEffect(() => {
    const container = heatmapScrollRef.current
    if (!container || !heatmapModel?.weeks) {
      return
    }
    const today = new Date()
    const isCurrentYear = year === today.getFullYear()
    const targetDate = isCurrentYear ? today : contributionRange.toDate
    const dayIndex = Math.min(
      heatmapModel.totalDays - 1,
      Math.max(0, daysBetween(heatmapModel.startDate, targetDate)),
    )
    const targetCol = Math.floor(dayIndex / heatmapRows)
    const targetLeft = Math.max(0, (targetCol + 1) * colWidthPx - container.clientWidth)
    container.scrollTo({ left: targetLeft, behavior: 'auto' })
  }, [contributionRange.toDate, heatmapModel, year])

  const showToast = (message) => {
    setToastMessage(message)
    window.setTimeout(() => {
      setToastMessage('')
    }, 1600)
  }

  useEffect(() => {
    let mounted = true

    const fetchProfile = async () => {
      setIsLoadingProfile(true)
      setLoadError('')
      try {
        const { data } = await api.get('/api/user/profile')
        if (!mounted) {
          return
        }
        const profile = data?.data
        const nextNickname = profile?.nickname ?? '코딩 마스터'
        setNickname(nextNickname)
        setDraftNickname(nextNickname)
        setSelectedAvatarId(profile?.avatarId ?? null)
        setAvatarUrl(profile?.avatarImageUrl ?? '')
      } catch {
        if (!mounted) {
          return
        }
        setLoadError('프로필을 불러오지 못했습니다.')
      } finally {
        if (mounted) {
          setIsLoadingProfile(false)
        }
      }
    }

    const fetchStats = async () => {
      setIsLoadingStats(true)
      try {
        const { data } = await api.get('/api/user/stats')
        if (!mounted) {
          return
        }
        const payload = data?.data
        setStats({
          solvedCount: payload?.solvedCount ?? 0,
          solvingCount: payload?.solvingCount ?? 0,
          totalXp: payload?.totalXp ?? 0,
        })
      } catch {
        if (!mounted) {
          return
        }
        setLoadError('통계 정보를 불러오지 못했습니다.')
      } finally {
        if (mounted) {
          setIsLoadingStats(false)
        }
      }
    }

    fetchProfile()
    fetchStats()

    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    let mounted = true

    const fetchContribution = async () => {
      setIsLoadingContribution(true)
      const fromDate = formatDate(contributionRange.fromDate)
      const toDate = formatDate(contributionRange.toDate)
      try {
        const { data } = await api.get('/api/user/contribution', {
          params: { from_date: fromDate, to_date: toDate },
        })
        if (!mounted) {
          return
        }
        setDailySolveCount(data?.data?.dailySolveCount ?? [])
        setSelectedCell(null)
      } catch {
        if (!mounted) {
          return
        }
        setLoadError('기여도 정보를 불러오지 못했습니다.')
        setDailySolveCount([])
        setSelectedCell(null)
      } finally {
        if (mounted) {
          setIsLoadingContribution(false)
        }
      }
    }

    fetchContribution()

    return () => {
      mounted = false
    }
  }, [contributionRange])

  const handleStartEdit = async () => {
    setDraftNickname(nickname)
    setIsEditing(true)
    setIsAvatarPickerOpen(false)

    if (avatars.length > 0) {
      return
    }

    setAvatarError('')
    try {
      const { data } = await api.get('/api/avatars')
      setAvatars(data?.data?.avatars ?? [])
    } catch {
      setAvatarError('아바타 목록을 불러오지 못했습니다.')
    }
  }

  const handleCancelEdit = () => {
    setDraftNickname(nickname)
    setIsEditing(false)
    setAvatarError('')
    setIsAvatarPickerOpen(false)
  }

  const handleSaveEdit = async () => {
    const nextNickname = draftNickname.trim()
    if (!nextNickname || isSaving) {
      return
    }

    setIsSaving(true)
    setLoadError('')
    try {
      const { data } = await api.patch('/api/user/profile', {
        nickname: nextNickname,
        avatarId: selectedAvatarId,
      })
      const updatedNickname = data?.data?.nickname ?? nextNickname
      const updatedAvatarUrl = data?.data?.avatarUrl ?? avatarUrl
      setNickname(updatedNickname)
      setAvatarUrl(updatedAvatarUrl)
      setIsEditing(false)
      setIsAvatarPickerOpen(false)
      showToast('저장이 완료되었습니다.')
    } catch {
      setLoadError('프로필 저장에 실패했습니다.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleLogout = async () => {
    if (isLoggingOut) {
      return
    }
    setIsLoggingOut(true)
    try {
      await logout()
    } finally {
      window.location.replace('/login')
      setIsLoggingOut(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (isDeleting) {
      return
    }
    const confirmed = window.confirm('정말 회원 탈퇴하시겠어요?')
    if (!confirmed) {
      return
    }

    setIsDeleting(true)
    try {
      await api.delete('/api/user')
      clearAccessToken()
      window.location.replace('/login')
    } catch {
      setLoadError('회원 탈퇴에 실패했습니다.')
    } finally {
      setIsDeleting(false)
    }
  }

  const isAnyLoading = isLoadingProfile || isLoadingStats || isLoadingContribution

  const statCards = [
    { label: '해결한 문제', value: stats.solvedCount },
    { label: '도전 중인 문제', value: stats.solvingCount },
    { label: '누적 XP', value: stats.totalXp },
  ]

  return (
    <div className="space-y-6">
      <section className="rounded-[24px] border border-black/10 bg-white p-4 shadow-[0_12px_24px_rgba(15,23,42,0.06)]">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="relative h-20 w-20 overflow-hidden rounded-full bg-[#4b5563]">
              {avatarUrl ? (
                <img alt="avatar" className="h-full w-full object-cover" src={avatarUrl} />
              ) : null}
              {isEditing ? (
                <button
                  className="absolute left-1/2 top-1/2 w-[72px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/70 bg-white/95 px-3 py-1 text-xs font-semibold text-foreground shadow-sm"
                  type="button"
                  onClick={() => setIsAvatarPickerOpen(true)}
                >
                  변경
                </button>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <button
                  className="rounded-md border border-black/40 px-3 py-1.5 text-xs font-semibold"
                  type="button"
                  onClick={handleCancelEdit}
                >
                  취소
                </button>
                <button
                  className="rounded-md border border-black/60 px-3 py-1.5 text-xs font-semibold text-foreground disabled:opacity-60"
                  disabled={isSaving}
                  type="button"
                  onClick={handleSaveEdit}
                >
                  {isSaving ? '저장 중...' : '저장'}
                </button>
              </>
            ) : (
              <>
                <button className="text-sm font-semibold" type="button" onClick={handleStartEdit}>
                  편집
                </button>
                <button
                  className="text-sm font-semibold text-muted-foreground disabled:opacity-60"
                  disabled={isLoggingOut}
                  type="button"
                  onClick={handleLogout}
                >
                  {isLoggingOut ? '로그아웃 중...' : '로그아웃'}
                </button>
              </>
            )}
          </div>
        </div>

        <div className="mt-3 space-y-2">
          {!isEditing ? (
            <h2 className="text-2xl font-semibold tracking-tight">{nickname}</h2>
          ) : (
            <>
              <input
                className="w-full rounded-lg border border-black/40 bg-white px-3 py-2.5 text-base font-semibold outline-none focus:border-black"
                value={draftNickname}
                onChange={(event) => setDraftNickname(event.target.value)}
                placeholder="닉네임을 입력하세요"
              />
              <p className="text-[11px] font-semibold text-muted-foreground">{helperText}</p>
            </>
          )}
        </div>

        {isEditing && isAvatarPickerOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
            <div className="w-full max-w-[360px] rounded-2xl border border-black/10 bg-white p-4 shadow-[0_20px_50px_rgba(15,23,42,0.18)]">
              <div className="flex items-center justify-center">
                <p className="text-xl font-bold">프로필 이미지 변경</p>
              </div>
              {avatarError ? (
                <p className="mt-2 text-[11px] font-semibold text-red-500">{avatarError}</p>
              ) : null}
              <div className="mt-4 grid grid-cols-3 justify-items-center gap-4">
                {avatars.map((avatar) => {
                  const selected = avatar.avatarId === selectedAvatarId
                  return (
                    <button
                      key={avatar.avatarId}
                      className={`relative h-20 w-20 overflow-hidden rounded-full border ${
                        selected ? 'border-black' : 'border-black/20'
                      }`}
                      type="button"
                      onClick={() => {
                        setSelectedAvatarId(avatar.avatarId)
                        setAvatarUrl(avatar.url)
                      }}
                    >
                      <img
                        alt="avatar option"
                        className="h-full w-full object-cover"
                        src={avatar.url}
                      />
                      {selected ? (
                        <span className="absolute inset-0 flex items-center justify-center bg-white/70">
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-base font-semibold text-foreground shadow-sm">
                            ✓
                          </span>
                        </span>
                      ) : null}
                    </button>
                  )
                })}
              </div>
              <div className="mt-5 flex items-center justify-center gap-3">
                <button
                  className="min-w-[96px] rounded-md border border-black/40 px-4 py-2 text-sm font-semibold"
                  type="button"
                  onClick={() => setIsAvatarPickerOpen(false)}
                >
                  취소
                </button>
                <button
                  className="min-w-[96px] rounded-md border border-black/60 px-4 py-2 text-sm font-semibold"
                  type="button"
                  onClick={() => setIsAvatarPickerOpen(false)}
                >
                  확인
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {isAnyLoading ? <StatusMessage className="mt-3">불러오는 중...</StatusMessage> : null}
        {loadError ? (
          <StatusMessage className="mt-2" tone="error">
            {loadError}
          </StatusMessage>
        ) : null}
      </section>

      <section className="grid grid-cols-3 gap-3">
        {statCards.map((item) => (
          <StatCard key={item.label} label={item.label} value={item.value} />
        ))}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-end">
          <div className="relative">
            <button
              className="inline-flex items-center gap-2 rounded-2xl border border-black/15 bg-white px-4 py-2 text-sm font-semibold shadow-[0_10px_20px_rgba(15,23,42,0.05)]"
              type="button"
              onClick={() => setIsYearMenuOpen((prev) => !prev)}
            >
              <span>{year}년</span>
              <span aria-hidden className="text-xs text-muted-foreground">
                ▾
              </span>
            </button>
            {isYearMenuOpen ? (
              <div className="absolute right-0 z-10 mt-2 w-28 rounded-2xl border border-black/10 bg-white p-1 shadow-[0_16px_32px_rgba(15,23,42,0.12)]">
                {years.map((value) => (
                  <button
                    key={value}
                    className={`w-full rounded-xl px-3 py-2 text-left text-sm font-semibold transition hover:bg-[#f3f4f6] ${
                      value === year ? 'bg-[#f3f4f6]' : ''
                    }`}
                    type="button"
                    onClick={() => {
                      setYear(value)
                      setIsYearMenuOpen(false)
                    }}
                  >
                    {value}년
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <Heatmap
          model={heatmapModel}
          monthMarkers={monthMarkers}
          scrollRef={heatmapScrollRef}
          selectedCell={selectedCell}
          onSelectCell={setSelectedCell}
        />
      </section>

      <section className="flex justify-end">
        <button
          className="text-sm font-semibold text-foreground/70 disabled:opacity-60"
          disabled={isDeleting}
          type="button"
          onClick={handleDeleteAccount}
        >
          {isDeleting ? '탈퇴 처리 중...' : '회원 탈퇴'}
        </button>
      </section>

      {toastMessage ? (
        <div className="rounded-2xl border border-black/10 bg-white px-4 py-5 text-center text-sm font-semibold shadow-[0_16px_32px_rgba(15,23,42,0.12)]">
          {toastMessage}
        </div>
      ) : null}
    </div>
  )
}
