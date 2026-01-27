import { useEffect, useMemo, useRef, useState } from 'react'

import { api } from '@/lib/api'
import { clearAccessToken, logout } from '@/lib/auth'

const years = [2023, 2024, 2025, 2026]
const heatmapRows = 7
const heatmapCellPx = 16
const heatmapGapPx = 4

const levelClasses = [
  'bg-[#ebedf0]',
  'bg-[#d6f5d6]',
  'bg-[#b7ecb7]',
  'bg-[#8ddb8d]',
  'bg-[#57c957]',
  'bg-[#2ea043]',
]

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

const getContributionRange = (year) => {
  const startOfYear = new Date(year, 0, 1)
  const endOfYear = new Date(year, 11, 31)
  return { fromDate: startOfYear, toDate: endOfYear }
}

const buildHeatmapCells = (dailySolveCount, range) => {
  const countByDate = new Map(
    (dailySolveCount ?? []).map((item) => [String(item.date), item.solveCount]),
  )
  const totalDays = Math.max(1, Math.round((range.toDate - range.fromDate) / 86400000) + 1)
  const weeks = Math.ceil(totalDays / heatmapRows)
  const totalCells = weeks * heatmapRows
  const minWidthPx = weeks * (heatmapCellPx + heatmapGapPx)

  const cells = Array.from({ length: totalCells }, (_, idx) => {
    if (idx >= totalDays) {
      return { id: `pad-${idx}`, level: 0 }
    }
    const date = addDays(range.fromDate, idx)
    const key = formatDate(date)
    const solveCount = countByDate.get(key) ?? 0
    const level = Math.min(5, Math.max(0, solveCount))
    return { id: key, level }
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

function Heatmap({ model, scrollRef }) {
  return (
    <div className="rounded-2xl border border-black/15 bg-white p-3 shadow-[0_12px_24px_rgba(15,23,42,0.06)]">
      <div ref={scrollRef} className="overflow-x-auto pb-1">
        <div
          className="grid gap-1"
          style={{
            gridTemplateColumns: `repeat(${model.weeks}, ${heatmapCellPx}px)`,
            minWidth: `${model.minWidthPx}px`,
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
                    className={`h-4 w-4 rounded-[2px] ${levelClasses[cell.level]}`}
                  />
                )
              })}
            </div>
          ))}
        </div>
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
  )
}

export default function MyPage() {
  const [isEditing, setIsEditing] = useState(false)
  const [nickname, setNickname] = useState('코딩 마스터')
  const [draftNickname, setDraftNickname] = useState(nickname)
  const [year, setYear] = useState(2025)
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
  const [stats, setStats] = useState({ solvedCount: 0, solvingCount: 0, totalXp: 0 })
  const [dailySolveCount, setDailySolveCount] = useState([])
  const heatmapScrollRef = useRef(null)

  const helperText = useMemo(() => '2자 이상 15자 이하 입력 (공백, 특수문자, 비속어 제외)', [])

  const contributionRange = useMemo(() => getContributionRange(year), [year])

  const heatmapModel = useMemo(
    () => buildHeatmapCells(dailySolveCount, contributionRange),
    [contributionRange, dailySolveCount],
  )

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
    const colWidth = heatmapCellPx + heatmapGapPx
    const targetLeft = Math.max(0, (targetCol + 1) * colWidth - container.clientWidth)
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
      } catch {
        if (!mounted) {
          return
        }
        setLoadError('기여도 정보를 불러오지 못했습니다.')
        setDailySolveCount([])
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
      <section className="rounded-[28px] border border-black/10 bg-gradient-to-br from-white via-white to-[#f3f8ff] p-5 shadow-[0_18px_36px_rgba(15,23,42,0.10)]">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3">
            <div className="h-20 w-20 overflow-hidden rounded-full bg-[#4b5563]">
              {avatarUrl ? (
                <img alt="avatar" className="h-full w-full object-cover" src={avatarUrl} />
              ) : null}
            </div>
            {!isEditing ? (
              <div className="flex items-center gap-3 text-sm font-semibold">
                <button className="text-foreground/80" type="button" onClick={handleStartEdit}>
                  편집
                </button>
                <button
                  className="text-foreground/60 disabled:opacity-60"
                  disabled={isLoggingOut}
                  type="button"
                  onClick={handleLogout}
                >
                  {isLoggingOut ? '로그아웃 중...' : '로그아웃'}
                </button>
              </div>
            ) : (
              <button
                className="rounded-full border border-black/15 px-3 py-1 text-xs font-semibold"
                type="button"
              >
                변경
              </button>
            )}
          </div>

          {isEditing ? (
            <div className="flex items-center gap-2">
              <button
                className="rounded-lg border border-black/15 px-3 py-1.5 text-xs font-semibold"
                type="button"
                onClick={handleCancelEdit}
              >
                취소
              </button>
              <button
                className="rounded-lg bg-foreground px-3 py-1.5 text-xs font-semibold text-background disabled:opacity-60"
                disabled={isSaving}
                type="button"
                onClick={handleSaveEdit}
              >
                {isSaving ? '저장 중...' : '저장'}
              </button>
            </div>
          ) : null}
        </div>

        <div className="mt-5 space-y-3">
          {!isEditing ? (
            <h2 className="text-2xl font-semibold tracking-tight">{nickname}</h2>
          ) : (
            <div className="space-y-2">
              <input
                className="w-full rounded-2xl border border-black/20 bg-white px-4 py-3 text-base font-semibold outline-none focus:border-black"
                value={draftNickname}
                onChange={(event) => setDraftNickname(event.target.value)}
                placeholder="닉네임을 입력하세요"
              />
              <p className="text-[11px] font-semibold text-muted-foreground">{helperText}</p>
            </div>
          )}
        </div>

        {isEditing ? (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground">아바타 선택</p>
              {avatarError ? (
                <span className="text-[11px] font-semibold text-red-500">{avatarError}</span>
              ) : null}
            </div>
            <div className="grid grid-cols-4 gap-2">
              {avatars.map((avatar) => {
                const selected = avatar.avatarId === selectedAvatarId
                return (
                  <button
                    key={avatar.avatarId}
                    className={`overflow-hidden rounded-2xl border ${
                      selected ? 'border-black' : 'border-black/10'
                    }`}
                    type="button"
                    onClick={() => {
                      setSelectedAvatarId(avatar.avatarId)
                      setAvatarUrl(avatar.url)
                    }}
                  >
                    <img
                      alt="avatar option"
                      className="h-16 w-full object-cover"
                      src={avatar.url}
                    />
                  </button>
                )
              })}
            </div>
          </div>
        ) : null}

        {isAnyLoading ? <p className="mt-3 text-xs text-muted-foreground">불러오는 중...</p> : null}
        {loadError ? <p className="mt-2 text-xs font-semibold text-red-500">{loadError}</p> : null}
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
        <Heatmap model={heatmapModel} scrollRef={heatmapScrollRef} />
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
