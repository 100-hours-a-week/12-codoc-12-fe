import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import Heatmap, { HEATMAP_COL_WIDTH_PX, HEATMAP_ROWS } from '@/components/Heatmap'
import StatusMessage from '@/components/StatusMessage'
import { api } from '@/lib/api'
import { clearAccessToken, logout } from '@/lib/auth'

const years = [2026, 2025, 2024, 2023]
const recentLabel = '최근'
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

const formatDate = (date) => date.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })

const addDays = (date, days) => {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

const daysBetween = (from, to) => Math.floor((to - from) / 86400000)

const getWeekStartSunday = (date) => {
  const start = new Date(date)
  start.setDate(start.getDate() - start.getDay())
  return start
}

const getKstToday = () => {
  const now = new Date()
  const kstDate = now.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
  return new Date(`${kstDate}T00:00:00+09:00`)
}

const getRecentContributionRange = () => {
  const today = getKstToday()
  const fromDate = addDays(today, -364)
  return { fromDate, toDate: today }
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

const buildMonthMarkers = (range, gridStartDate) => {
  const markers = []
  const cursor = new Date(range.fromDate.getFullYear(), range.fromDate.getMonth(), 1)

  while (cursor < range.fromDate) {
    cursor.setMonth(cursor.getMonth() + 1)
  }

  while (cursor <= range.toDate) {
    const dayIndex = daysBetween(gridStartDate, cursor)
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
  const gridStart = getWeekStartSunday(range.fromDate)
  const totalDays = Math.max(1, Math.round((range.toDate - gridStart) / 86400000) + 1)
  const weeks = Math.ceil(totalDays / heatmapRows)
  const totalCells = weeks * heatmapRows
  const minWidthPx = weeks * colWidthPx

  const cells = Array.from({ length: totalCells }, (_, idx) => {
    if (idx >= totalDays) {
      return { id: `pad-${idx}`, level: 0, date: null, solveCount: 0 }
    }
    const date = addDays(gridStart, idx)
    if (date < range.fromDate) {
      return { id: `pad-${idx}`, level: 0, date: null, solveCount: 0 }
    }
    if (cutoffDate && date > cutoffDate) {
      return { id: `future-${idx}`, level: 0, date: null, solveCount: 0 }
    }
    const key = formatDate(date)
    const solveCount = countByDate.get(key) ?? 0
    const level = Math.min(5, Math.max(0, solveCount))
    return { id: key, level, date: key, solveCount }
  })

  return { cells, weeks, minWidthPx, startDate: gridStart, totalDays }
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-black/15 bg-white px-3 py-4 text-center shadow-[0_10px_20px_rgba(15,23,42,0.05)]">
      <p className="text-lg font-semibold">{value}</p>
      <p className="mt-1 text-xs font-semibold text-muted-foreground">{label}</p>
    </div>
  )
}

export default function MyPage() {
  const [isEditing, setIsEditing] = useState(false)
  const [nickname, setNickname] = useState('코딩 마스터')
  const [draftNickname, setDraftNickname] = useState(nickname)
  const [year, setYear] = useState('recent')
  const [isYearMenuOpen, setIsYearMenuOpen] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [isLoadingProfile, setIsLoadingProfile] = useState(true)
  const [isLoadingStats, setIsLoadingStats] = useState(true)
  const [isLoadingContribution, setIsLoadingContribution] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [showNicknameHelper, setShowNicknameHelper] = useState(false)
  const [nicknameHelperVariant, setNicknameHelperVariant] = useState('invalid')
  const [isDeleting, setIsDeleting] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [avatars, setAvatars] = useState([])
  const [avatarError, setAvatarError] = useState('')
  const [selectedAvatarId, setSelectedAvatarId] = useState(null)
  const [avatarUrl, setAvatarUrl] = useState('')
  const [profileAvatarId, setProfileAvatarId] = useState(null)
  const [profileAvatarUrl, setProfileAvatarUrl] = useState('')
  const [isAvatarPickerOpen, setIsAvatarPickerOpen] = useState(false)
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false)
  const [selectedDailyGoal, setSelectedDailyGoal] = useState('ONE')
  const [isSavingGoal, setIsSavingGoal] = useState(false)
  const [stats, setStats] = useState({ solvedCount: 0, solvingCount: 0, totalXp: 0 })
  const [dailySolveCount, setDailySolveCount] = useState([])
  const heatmapScrollRef = useRef(null)
  const [selectedCell, setSelectedCell] = useState(null)

  const helperText = useMemo(
    () => ({
      main: '2~15자 · 한글(완성형)·영문·숫자만 사용 가능',
      sub: '공백/특수문자/자모/비속어 불가',
    }),
    [],
  )

  const contributionRange = useMemo(() => {
    if (year === 'recent') {
      return getRecentContributionRange()
    }
    return getContributionRange(year)
  }, [year])

  const heatmapModel = useMemo(() => {
    const today = getKstToday()
    const isCurrentYear = year !== 'recent' && year === today.getFullYear()
    const cutoffDate = year === 'recent' || isCurrentYear ? today : null
    return buildHeatmapCells(dailySolveCount, contributionRange, cutoffDate)
  }, [contributionRange, dailySolveCount, year])
  const monthMarkers = useMemo(
    () => buildMonthMarkers(contributionRange, heatmapModel.startDate),
    [contributionRange, heatmapModel.startDate],
  )

  useEffect(() => {
    const container = heatmapScrollRef.current
    if (!container || !heatmapModel?.weeks) {
      return
    }
    const today = new Date()
    const isCurrentYear = year !== 'recent' && year === today.getFullYear()
    const targetDate = year === 'recent' || isCurrentYear ? today : contributionRange.toDate
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

  const goalOptions = [
    { value: 'ONE', label: '하루 1문제' },
    { value: 'THREE', label: '하루 3문제' },
    { value: 'FIVE', label: '하루 5문제' },
  ]

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
        const nextAvatarId = profile?.avatarId ?? null
        const nextAvatarUrl = profile?.avatarImageUrl ?? ''
        setSelectedAvatarId(nextAvatarId)
        setAvatarUrl(nextAvatarUrl)
        setProfileAvatarId(nextAvatarId)
        setProfileAvatarUrl(nextAvatarUrl)
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

    const fetchDailyGoal = async () => {
      try {
        const { data } = await api.get('/api/user/daily-goal')
        if (!mounted) {
          return
        }
        setSelectedDailyGoal(data?.data?.dailyGoal ?? 'ONE')
      } catch {
        if (!mounted) {
          return
        }
        setLoadError('일일 목표 정보를 불러오지 못했습니다.')
      }
    }

    fetchProfile()
    fetchStats()
    fetchDailyGoal()

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

  const handleSaveDailyGoal = async () => {
    if (isSavingGoal) {
      return
    }
    setIsSavingGoal(true)
    setLoadError('')
    try {
      await api.patch('/api/user/daily-goal', { dailyGoal: selectedDailyGoal })
      setIsGoalModalOpen(false)
      showToast('저장이 완료되었습니다.')
    } catch {
      setLoadError('일일 목표 저장에 실패했습니다.')
    } finally {
      setIsSavingGoal(false)
    }
  }

  const handleStartEdit = async () => {
    setDraftNickname(nickname)
    setShowNicknameHelper(false)
    setNicknameHelperVariant('invalid')
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
    setSelectedAvatarId(profileAvatarId)
    setAvatarUrl(profileAvatarUrl)
    setShowNicknameHelper(false)
    setNicknameHelperVariant('invalid')
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
      const updatedAvatarId = data?.data?.avatarId ?? selectedAvatarId
      setNickname(updatedNickname)
      setAvatarUrl(updatedAvatarUrl)
      setProfileAvatarId(updatedAvatarId)
      setProfileAvatarUrl(updatedAvatarUrl)
      setSelectedAvatarId(updatedAvatarId)
      setShowNicknameHelper(false)
      setNicknameHelperVariant('invalid')
      setIsEditing(false)
      setIsAvatarPickerOpen(false)
      showToast('저장이 완료되었습니다.')
    } catch (error) {
      const errorCode = error?.response?.data?.code
      const isDuplicate = error?.response?.status === 409 || errorCode === 'DUPLICATE_NICKNAME'
      setNicknameHelperVariant(isDuplicate ? 'duplicate' : 'invalid')
      setShowNicknameHelper(true)
      showToast('프로필 저장에 실패했습니다.')
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
              {showNicknameHelper ? (
                nicknameHelperVariant === 'duplicate' ? (
                  <p className="text-[11px] font-semibold text-red-500">
                    이미 사용 중인 닉네임입니다.
                  </p>
                ) : (
                  <div className="space-y-1 text-red-500">
                    <p className="text-[11px] font-semibold">{helperText.main}</p>
                    <p className="text-[10px] font-medium">{helperText.sub}</p>
                  </div>
                )
              ) : null}
            </>
          )}
        </div>

        {isEditing && isAvatarPickerOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
            <div className="flex w-full max-w-[360px] max-h-[420px] flex-col rounded-2xl border border-black/10 bg-white p-4 shadow-[0_20px_50px_rgba(15,23,42,0.18)]">
              <div className="flex items-center justify-center">
                <p className="text-xl font-bold">프로필 이미지 변경</p>
              </div>
              {avatarError ? (
                <p className="mt-2 text-[11px] font-semibold text-red-500">{avatarError}</p>
              ) : null}
              <div className="mt-4 max-h-[220px] overflow-y-auto">
                <div className="grid grid-cols-3 justify-items-center gap-4">
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

      {isEditing ? (
        <section className="flex justify-end pr-4">
          <button
            className="text-sm font-semibold text-foreground/70 disabled:opacity-60"
            disabled={isDeleting}
            type="button"
            onClick={() => setIsDeleteModalOpen(true)}
          >
            {isDeleting ? '탈퇴 처리 중...' : '회원 탈퇴'}
          </button>
        </section>
      ) : (
        <>
          <section className="grid grid-cols-3 gap-3">
            {statCards.map((item) => (
              <StatCard key={item.label} label={item.label} value={item.value} />
            ))}
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <button
                className="rounded-xl border border-black/20 bg-white px-4 py-2 text-sm font-semibold text-foreground shadow-sm"
                type="button"
                onClick={() => setIsGoalModalOpen(true)}
              >
                일일 목표 설정
              </button>
              <div className="relative">
                <button
                  className="inline-flex items-center gap-2 rounded-2xl border border-black/15 bg-white px-4 py-2 text-sm font-semibold shadow-[0_10px_20px_rgba(15,23,42,0.05)]"
                  type="button"
                  onClick={() => setIsYearMenuOpen((prev) => !prev)}
                >
                  <span>{year === 'recent' ? recentLabel : `${year}년`}</span>
                  <span aria-hidden className="text-xs text-muted-foreground">
                    ▾
                  </span>
                </button>
                {isYearMenuOpen ? (
                  <div className="absolute right-0 z-10 mt-2 w-28 rounded-2xl border border-black/10 bg-white p-1 shadow-[0_16px_32px_rgba(15,23,42,0.12)]">
                    <button
                      className={`w-full rounded-xl px-3 py-2 text-left text-sm font-semibold transition hover:bg-[#f3f4f6] ${
                        year === 'recent' ? 'bg-[#f3f4f6]' : ''
                      }`}
                      type="button"
                      onClick={() => {
                        setYear('recent')
                        setIsYearMenuOpen(false)
                      }}
                    >
                      {recentLabel}
                    </button>
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
              levelClasses={levelClasses}
            />
          </section>

          {toastMessage ? (
            <div className="rounded-2xl border border-black/10 bg-white px-4 py-5 text-center text-sm font-semibold shadow-[0_16px_32px_rgba(15,23,42,0.12)]">
              {toastMessage}
            </div>
          ) : null}
        </>
      )}
      {isDeleteModalOpen
        ? createPortal(
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
              <div className="w-full max-w-[360px] rounded-2xl border border-black/10 bg-white p-5 shadow-[0_20px_50px_rgba(15,23,42,0.18)]">
                <div className="flex items-center justify-center">
                  <p className="text-xl font-bold">회원 탈퇴</p>
                </div>
                <p className="mt-3 text-center text-sm text-muted-foreground">
                  탈퇴 시 데이터가 복구되지 않을 수 있습니다.
                  <br />
                  계속 진행하시겠어요?
                </p>
                <div className="mt-5 flex items-center justify-center gap-3">
                  <button
                    className="min-w-[96px] rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background"
                    type="button"
                    onClick={() => setIsDeleteModalOpen(false)}
                  >
                    취소
                  </button>
                  <button
                    className="min-w-[96px] rounded-md border border-black/60 px-4 py-2 text-sm font-semibold text-foreground disabled:opacity-60"
                    type="button"
                    onClick={async () => {
                      setIsDeleteModalOpen(false)
                      await handleDeleteAccount()
                    }}
                    disabled={isDeleting}
                  >
                    {isDeleting ? '탈퇴 중...' : '탈퇴'}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
      {isGoalModalOpen
        ? createPortal(
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
              <div className="w-full max-w-[360px] rounded-2xl border border-black/10 bg-white p-5 shadow-[0_20px_50px_rgba(15,23,42,0.18)]">
                <div className="flex items-center justify-center">
                  <p className="text-xl font-bold">일일 목표 설정</p>
                </div>
                <div className="mt-4 space-y-3">
                  {goalOptions.map((option) => {
                    const selected = option.value === selectedDailyGoal
                    return (
                      <button
                        key={option.value}
                        className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-sm font-semibold ${
                          selected
                            ? 'border-info text-info bg-transparent'
                            : 'border-info/30 bg-white text-foreground'
                        }`}
                        type="button"
                        onClick={() => setSelectedDailyGoal(option.value)}
                      >
                        <span>{option.label}</span>
                        {selected ? <span className="text-base">✓</span> : null}
                      </button>
                    )
                  })}
                </div>
                <div className="mt-5 flex items-center justify-center gap-3">
                  <button
                    className="min-w-[96px] rounded-md px-4 py-2 text-sm font-semibold text-foreground"
                    type="button"
                    onClick={() => setIsGoalModalOpen(false)}
                  >
                    취소
                  </button>
                  <button
                    className="min-w-[96px] rounded-md border border-info bg-info px-4 py-2 text-sm font-semibold text-white hover:bg-info/90"
                    type="button"
                    onClick={handleSaveDailyGoal}
                    disabled={isSavingGoal}
                  >
                    {isSavingGoal ? '저장 중...' : '저장'}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
