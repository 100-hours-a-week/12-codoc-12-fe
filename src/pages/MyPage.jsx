import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'

import Heatmap, { HEATMAP_COL_WIDTH_PX, HEATMAP_ROWS } from '@/components/Heatmap'
import StatusMessage from '@/components/StatusMessage'
import { api } from '@/lib/api'
import { clearAccessToken, logout } from '@/lib/auth'
import { deactivateNotificationDevice } from '@/services/notifications/notificationsService'

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

const formatShortDate = (value) => {
  if (!value) {
    return ''
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10).replaceAll('-', '.')
  }
  if (typeof value === 'string') {
    return value.slice(0, 10).replaceAll('-', '.')
  }
  return ''
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

const paragraphLabelMap = {
  BACKGROUND: '배경',
  GOAL: '목표',
  RULE: '규칙',
  CONSTRAINT: '제약',
  INSIGHT: '핵심 아이디어',
  STRATEGY: '풀이 전략',
}

const quizLabelMap = {
  ALGORITHM: '알고리즘 선택',
  LOGIC_CHECK: '로직 점검',
  DATA_STRUCTURE: '자료구조 선택',
  TIME_COMPLEXITY: '시간 복잡도 판단',
}

const metricLabelMap = {
  accuracy: '정확도',
  independence: '독립성',
  efficiency: '효율성',
  consistency: '일관성',
}

const reportCharacterImageByUserType = {
  '숲을 지배한 코알라': 'https://images.codoc.cloud/images/report_codoc/forest.png',
  '뿌리 깊은 코알라': 'https://images.codoc.cloud/images/report_codoc/ppuri.png',
  '번개 맞은 코알라': 'https://images.codoc.cloud/images/report_codoc/bungae.png',
  '잠재력 폭발 아기 코알라': 'https://images.codoc.cloud/images/report_codoc/agi.png',
}

const resolveReportCharacterImage = (userType) => {
  const key = String(userType ?? '').trim()
  return reportCharacterImageByUserType[key] ?? 'https://images.codoc.cloud/images/report.png'
}

const clampScore = (value) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return 0
  }
  return Math.min(100, Math.max(0, numeric))
}

const getScoreLabel = (score) => {
  if (score >= 80) {
    return '매우 안정적'
  }
  if (score >= 60) {
    return '좋은 흐름'
  }
  if (score >= 40) {
    return '성장 구간'
  }
  return '집중 보완'
}

export default function MyPage() {
  const navigate = useNavigate()
  const [isEditing, setIsEditing] = useState(false)
  const [nickname, setNickname] = useState('')
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
  const [nicknameErrorMessage, setNicknameErrorMessage] = useState('')
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
  const [isLoadingReport, setIsLoadingReport] = useState(true)
  const [reportError, setReportError] = useState('')
  const [report, setReport] = useState(null)

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
        const nextNickname = profile?.nickname ?? ''
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
    const fetchReport = async () => {
      setIsLoadingReport(true)
      setReportError('')
      try {
        const { data } = await api.get('/api/user/report')
        if (!mounted) {
          return
        }
        setReport(data?.data ?? null)
      } catch {
        if (!mounted) {
          return
        }
        setReportError('분석 리포트를 준비중입니다.')
        setReport(null)
      } finally {
        if (mounted) {
          setIsLoadingReport(false)
        }
      }
    }

    fetchReport()

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
    setNicknameErrorMessage('')
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
      setNicknameErrorMessage('')
      setIsEditing(false)
      setIsAvatarPickerOpen(false)
      showToast('저장이 완료되었습니다.')
    } catch (error) {
      const errorCode = error?.response?.data?.code
      const invalidMessage = error?.response?.data?.data?.nickname ?? ''
      const isDuplicate = error?.response?.status === 409 || errorCode === 'DUPLICATE_NICKNAME'
      const isProfanity = typeof invalidMessage === 'string' && invalidMessage.includes('금지어')
      setNicknameHelperVariant(isDuplicate ? 'duplicate' : 'invalid')
      setNicknameErrorMessage(!isDuplicate && isProfanity ? invalidMessage : '')
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

    setIsDeleting(true)
    try {
      await deactivateNotificationDevice().catch(() => {})
      await api.delete('/api/user')
      clearAccessToken()
      window.location.replace('/login')
    } catch {
      setLoadError('회원 탈퇴에 실패했습니다.')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleOpenRecommended = async () => {
    try {
      const response = await api.get('/api/problems/recommended')
      const problemId = response?.data?.data?.problem?.problemId
      if (!problemId) {
        showToast('추천 문제가 아직 준비되지 않았어요.')
        return
      }
      navigate(`/problems/${problemId}`)
    } catch (error) {
      if (error?.response?.status === 404) {
        showToast('추천 문제가 아직 준비되지 않았어요.')
        return
      }
      showToast('추천 문제를 불러오지 못했습니다.')
    }
  }

  const isAnyLoading = isLoadingProfile || isLoadingStats || isLoadingContribution

  const statCards = [
    { label: '해결한 문제', value: `${Number(stats.solvedCount ?? 0).toLocaleString('ko-KR')}개` },
    {
      label: '도전 중인 문제',
      value: `${Number(stats.solvingCount ?? 0).toLocaleString('ko-KR')}개`,
    },
    { label: '누적 XP', value: `${Number(stats.totalXp ?? 0).toLocaleString('ko-KR')} XP` },
  ]
  const reportSummary = report?.report?.summary
  const reportPast = report?.report?.past_diagnosis
  const reportPresent = report?.report?.present_growth
  const reportFuture = report?.report?.future_roadmap
  const reportSummaryComment =
    reportSummary?.summary_comment ??
    reportPast?.summary_comment ??
    '이번 주 학습 리포트를 생성했어요.'
  const reportAnalysisText =
    reportPast?.analysis_text ?? reportFuture?.analysis_text ?? '약점 구간을 분석하고 있어요.'
  const reportStrategyTip =
    reportFuture?.strategy_tip ?? reportPast?.strategy_tip ?? '추천 전략이 곧 도착할 예정이에요.'
  const reportRecommendedAction =
    reportFuture?.recommended_action ??
    reportPast?.recommended_action ??
    '이번 주 실천 과제가 곧 제공될 예정이에요.'
  const weakSectionLabel =
    paragraphLabelMap[reportPast?.weak_section] ?? reportPast?.weak_section ?? '분석 중'
  const weakQuizLabel = quizLabelMap[reportPast?.weak_quiz] ?? reportPast?.weak_quiz ?? '분석 중'
  const weakestMetricLabel =
    metricLabelMap[reportPast?.weakest_metric] ?? reportPast?.weakest_metric ?? '분석 중'
  const metricCards = [
    {
      key: 'accuracy',
      label: '정확도',
      helper: '핵심 조건을 정확히 반영하는 힘',
      score: clampScore(reportPresent?.accuracy ?? 0),
    },
    {
      key: 'independence',
      label: '독립성',
      helper: '힌트 없이 스스로 푸는 힘',
      score: clampScore(reportPresent?.independence ?? 0),
    },
    {
      key: 'efficiency',
      label: '효율성',
      helper: '적절한 풀이를 빠르게 고르는 힘',
      score: clampScore(reportPresent?.efficiency ?? 0),
    },
    {
      key: 'consistency',
      label: '꾸준함',
      helper: '문제마다 안정적으로 푸는 힘',
      score: clampScore(reportPresent?.consistency ?? 0),
    },
  ]
  const reportRangeLabel =
    report?.analysis_period?.start_date && report?.analysis_period?.end_date
      ? `${formatShortDate(report.analysis_period.start_date)} ~ ${formatShortDate(
          report.analysis_period.end_date,
        )}`
      : report?.periodStart && report?.periodEnd
        ? `${formatShortDate(report.periodStart)} ~ ${formatShortDate(report.periodEnd)}`
        : ''
  const reportPeriodLabel = reportRangeLabel || '분석 기간 집계 중'
  const reportCharacterImage = resolveReportCharacterImage(reportSummary?.user_type)

  return (
    <div className="space-y-3">
      <section className="rounded-[24px] border border-black/10 bg-white p-4 shadow-[0_12px_24px_rgba(15,23,42,0.06)]">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-4">
            <div className="relative h-20 w-20 overflow-hidden rounded-full bg-[#4b5563]">
              {avatarUrl ? (
                <img alt="avatar" className="h-full w-full object-cover" src={avatarUrl} />
              ) : null}
              {isEditing ? (
                <button
                  className="absolute left-1/2 top-1/2 w-[72px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/70 bg-white/95 px-2 py-1 text-[11px] font-semibold text-foreground shadow-sm"
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
                    {nicknameErrorMessage ? (
                      <p className="text-[11px] font-semibold">{nicknameErrorMessage}</p>
                    ) : (
                      <>
                        <p className="text-[11px] font-semibold">{helperText.main}</p>
                      </>
                    )}
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
                  onClick={() => {
                    setSelectedAvatarId(profileAvatarId)
                    setAvatarUrl(profileAvatarUrl)
                    setIsAvatarPickerOpen(false)
                  }}
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
          <div className="space-y-3">
            <section className="overflow-hidden rounded-[24px] border border-black/10 bg-white shadow-[0_16px_32px_rgba(15,23,42,0.08)]">
              <div className="bg-gradient-to-r from-[#3f8eef] via-[#5ca4f6] to-[#74b6fa] px-4 py-4 text-white">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="h-[96px] w-[96px] shrink-0 overflow-hidden">
                      <img
                        alt="report"
                        className="h-full w-full max-w-none scale-[1.18] object-contain"
                        src="https://images.codoc.cloud/images/report.png"
                        onError={(event) => {
                          if (event.currentTarget.src.endsWith('/images/report.png')) {
                            event.currentTarget.style.display = 'none'
                            return
                          }
                          event.currentTarget.src = 'https://images.codoc.cloud/images/report.png'
                        }}
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-white/90">AI 학습 리포트</p>
                      <h3 className="mt-0.5 text-[19px] font-bold leading-tight">
                        학습 리포트를 통해 성장해보세요
                      </h3>
                      <div className="mt-1 inline-flex max-w-full items-center gap-1.5 rounded-full border border-white/45 bg-white/20 px-2.5 py-1">
                        <span className="shrink-0 text-[10px] font-semibold text-white/90">
                          분석 기간
                        </span>
                        <span className="truncate text-[11px] font-semibold text-white">
                          {reportPeriodLabel}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-1.5 grid grid-cols-3 gap-2">
                  {statCards.map((item) => (
                    <div
                      key={item.label}
                      className="rounded-xl border border-white/35 bg-white/95 px-2.5 py-2 text-[#0f172a] shadow-sm"
                    >
                      <p className="text-[10px] font-semibold text-[#64748b]">{item.label}</p>
                      <p className="mt-0.5 text-[14px] font-bold leading-none">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3 bg-[#f8faff] p-3">
                {isLoadingReport ? (
                  <StatusMessage>리포트를 불러오는 중...</StatusMessage>
                ) : reportError ? (
                  <div className="rounded-2xl border border-[#c3d4ea] bg-[linear-gradient(180deg,#f2f7ff_0%,#fbfdff_100%)] px-4 py-4 text-left shadow-[0_8px_18px_rgba(90,124,168,0.12)]">
                    <p className="text-[12px] font-semibold tracking-wide text-[#5a77a1]">
                      리포트 발급 안내
                    </p>
                    <p className="mt-1 text-[16px] font-bold leading-snug text-[#1f3d63]">
                      분석 리포트는 매주 월요일 오전 5시에 발급됩니다.
                    </p>
                  </div>
                ) : report ? (
                  <>
                    <div className="rounded-2xl border border-black/10 bg-white px-4 py-3">
                      <p className="text-xs font-semibold text-muted-foreground">성장지수</p>
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-end gap-2">
                            <span className="text-3xl font-bold leading-none">
                              {Number(reportSummary?.growth_index ?? 0).toFixed(1)}
                            </span>
                            <span className="pb-0.5 text-sm font-semibold text-muted-foreground">
                              / 100
                            </span>
                          </div>
                          <p className="mt-2 text-sm font-semibold text-foreground/85">
                            {reportSummary?.user_type ?? '분석 중'}
                          </p>
                          <p className="mt-1 text-xs font-medium text-muted-foreground">
                            {reportSummaryComment}
                          </p>
                        </div>
                        <div className="h-[112px] w-[112px] shrink-0 overflow-hidden">
                          <img
                            alt={
                              reportSummary?.user_type
                                ? `${reportSummary.user_type} 이미지`
                                : '유형 이미지'
                            }
                            className="h-full w-full object-contain"
                            src={reportCharacterImage}
                            onError={(event) => {
                              if (event.currentTarget.src.endsWith('/images/report.png')) {
                                event.currentTarget.style.display = 'none'
                                return
                              }
                              event.currentTarget.src =
                                'https://images.codoc.cloud/images/report.png'
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-black/10 bg-white px-4 py-3">
                      <p className="text-sm font-semibold">이번 주 핵심 분석</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <span className="rounded-full border border-black/10 bg-[#f8fafc] px-2.5 py-1 text-[11px] font-semibold text-foreground/80">
                          섹션: {weakSectionLabel}
                        </span>
                        <span className="rounded-full border border-black/10 bg-[#f8fafc] px-2.5 py-1 text-[11px] font-semibold text-foreground/80">
                          퀴즈: {weakQuizLabel}
                        </span>
                        <span className="rounded-full border border-black/10 bg-[#f8fafc] px-2.5 py-1 text-[11px] font-semibold text-foreground/80">
                          우선 지표: {weakestMetricLabel}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">{reportAnalysisText}</p>
                      <div className="mt-3 rounded-xl border border-black/10 bg-[#f8fafc] px-3 py-2">
                        <p className="text-[11px] font-semibold text-muted-foreground">
                          지금 집중하면 좋은 포인트
                        </p>
                        <p className="mt-1 text-xs font-semibold text-foreground/85">
                          {weakSectionLabel} 문맥과 {weakQuizLabel} 판단을 우선 정리하면{' '}
                          {weakestMetricLabel} 개선이 가장 빠르게 반영됩니다.
                        </p>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-black/10 bg-white px-4 py-4">
                      <p className="text-sm font-semibold">현재 성장 지표</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        점수가 높을수록 현재 풀이가 더 안정적이라는 뜻이에요.
                      </p>
                      <div className="mt-3 space-y-2.5">
                        {metricCards.map((item) => (
                          <div
                            key={item.key}
                            className="rounded-xl border border-black/10 bg-[#f8fafc] px-3 py-2"
                          >
                            <div className="flex items-center justify-between text-xs font-semibold">
                              <span>{item.label}</span>
                              <span className="text-foreground">{item.score}점</span>
                            </div>
                            <div className="mt-1.5 h-2 rounded-full bg-[#e5e7eb]">
                              <div
                                className="h-full rounded-full bg-[#60a5fa]"
                                style={{ width: `${item.score}%` }}
                              />
                            </div>
                            <div className="mt-1 flex items-center justify-between text-[11px]">
                              <span className="text-muted-foreground">{item.helper}</span>
                              <span className="font-semibold text-foreground/80">
                                {getScoreLabel(item.score)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <p className="mt-3 text-xs text-muted-foreground">
                        {reportPresent?.metrics_analysis_comment ??
                          '성장 지표를 기반으로 다음 학습을 추천합니다.'}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-black/10 bg-white px-4 py-3">
                      <p className="text-sm font-semibold">코독 제안 학습 플랜</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        아래 순서대로 따라하면 이번 주 점수를 가장 효율적으로 올릴 수 있어요.
                      </p>
                      <div className="mt-3 space-y-2">
                        <div className="rounded-xl border border-black/10 bg-[#f8fafc] px-3 py-2">
                          <p className="text-[11px] font-semibold text-muted-foreground">
                            1단계. 학습 전략
                          </p>
                          <p className="mt-1 text-xs font-semibold text-foreground/85">
                            {reportStrategyTip}
                          </p>
                        </div>
                        <div className="rounded-xl border border-black/10 bg-[#eef5ff] px-3 py-2">
                          <p className="text-[11px] font-semibold text-[#3b82f6]">
                            2단계. 이번 주 실행 과제
                          </p>
                          <p className="mt-1 text-xs font-semibold text-foreground/85">
                            {reportRecommendedAction}
                          </p>
                        </div>
                      </div>
                    </div>

                    <button
                      className="w-full rounded-2xl border border-[#cfe0ff] bg-[#eef5ff] px-4 py-3 text-left shadow-sm transition hover:bg-[#e2edff]"
                      type="button"
                      onClick={handleOpenRecommended}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-foreground">
                          AI 추천 문제 풀러 가기
                        </span>
                        <span className="text-sm text-muted-foreground" aria-hidden>
                          ›
                        </span>
                      </div>
                    </button>
                  </>
                ) : (
                  <StatusMessage>분석 리포트가 아직 없어요.</StatusMessage>
                )}
              </div>
            </section>

            <section className="rounded-[20px] border border-black/10 bg-white p-3 shadow-[0_10px_20px_rgba(15,23,42,0.06)]">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-[16px] font-bold tracking-tight text-foreground">
                    학습 히스토리
                  </h3>
                </div>
                <div className="flex items-center gap-2">
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
              </div>
              <div className="mt-3">
                <Heatmap
                  model={heatmapModel}
                  monthMarkers={monthMarkers}
                  scrollRef={heatmapScrollRef}
                  selectedCell={selectedCell}
                  onSelectCell={setSelectedCell}
                  levelClasses={levelClasses}
                />
              </div>
            </section>

            <div className="mt-3">
              <a
                className="block w-full rounded-xl border border-black/15 bg-white px-3 py-3 text-center text-[13px] font-medium text-foreground shadow-sm transition hover:bg-[#f3f4f6]"
                href="https://docs.google.com/forms/d/e/1FAIpQLSd7MbHiijJHphq767m1eeHmpmqqA8XRzcDuG2TljsBKCR3yqQ/viewform?pli=1"
                target="_blank"
                rel="noreferrer"
              >
                사용자 피드백 설문
              </a>
            </div>
          </div>
        </>
      )}
      {toastMessage
        ? createPortal(
            <div className="fixed inset-x-4 bottom-24 z-50 mx-auto max-w-[400px]">
              <div className="rounded-2xl border border-black/10 bg-white/75 px-4 py-4 text-center text-sm font-semibold shadow-[0_16px_32px_rgba(15,23,42,0.12)] backdrop-blur">
                {toastMessage}
              </div>
            </div>,
            document.body,
          )
        : null}
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
