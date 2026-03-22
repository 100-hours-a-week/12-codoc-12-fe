import { AnimatePresence, motion } from 'framer-motion'
import { AlarmClock, RefreshCw, Sparkles, Star, Trophy } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import remarkBreaks from 'remark-breaks'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import { useNavigate } from 'react-router-dom'

import { api } from '@/lib/api'
import StatusMessage from '@/components/StatusMessage'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatDifficultyLabel } from '@/constants/difficulty'
import { getLeagueBadgeImage } from '@/constants/leagueBadges'
import { normalizeProblemStatus, STATUS_OPTIONS } from '@/constants/problemStatusOptions'
import { getSurpriseQuiz, submitSurpriseQuiz } from '@/services/surpriseQuiz/surpriseQuizService'

const statusCopy = {
  IN_PROGRESS: { variant: 'pending', disabled: true },
  COMPLETED: { variant: 'ready', disabled: false },
  CLAIMED: { variant: 'done', disabled: true },
}

const markdownComponents = {
  p: ({ children }) => <span>{children}</span>,
}

const getChoiceLabel = (choiceNo) => String.fromCharCode(64 + choiceNo)

const formatElapsedLabel = (elapsedMs) => {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) {
    return '-'
  }

  const totalSeconds = Math.floor(elapsedMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  if (minutes <= 0) {
    return `${seconds}초`
  }

  return `${minutes}분 ${seconds}초`
}

const formatRemainingLabel = (eventEndsAt) => {
  if (!eventEndsAt) {
    return '종료 시각 미정'
  }

  const targetTime = new Date(eventEndsAt).getTime()
  if (Number.isNaN(targetTime)) {
    return '종료 시각 미정'
  }

  const diffMs = targetTime - Date.now()
  if (diffMs <= 0) {
    return '이벤트 종료'
  }

  const totalSeconds = Math.floor(diffMs / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}시간 ${minutes}분 남음`
  }

  if (minutes > 0) {
    return `${minutes}분 ${seconds}초 남음`
  }

  return `${seconds}초 남음`
}

const LEAGUE_HOME_COPY = {
  BRONZE: { title: '브론즈 리그', subtitle: '기초 다지는 시즌, 지금부터 치고 올라가요!' },
  SILVER: { title: '실버 리그', subtitle: '실력 붙는 구간, 순위 경쟁이 시작됐어요!' },
  GOLD: { title: '골드 리그', subtitle: '상위권 싸움 한가운데, 이번 주가 승부처예요!' },
  PLATINUM: { title: '플래티넘 리그', subtitle: '정예 리그 돌입, 한 문제 차이로 갈려요!' },
  DIAMOND: { title: '다이아몬드 리그', subtitle: '정상권 전장 오픈, 끝까지 집중해봐요!' },
  브론즈: { title: '브론즈 리그', subtitle: '기초 다지는 시즌, 지금부터 치고 올라가요!' },
  실버: { title: '실버 리그', subtitle: '실력 붙는 구간, 순위 경쟁이 시작됐어요!' },
  골드: { title: '골드 리그', subtitle: '상위권 싸움 한가운데, 이번 주가 승부처예요!' },
  플래티넘: { title: '플래티넘 리그', subtitle: '정예 리그 돌입, 한 문제 차이로 갈려요!' },
  다이아몬드: { title: '다이아몬드 리그', subtitle: '정상권 전장 오픈, 끝까지 집중해봐요!' },
}

const getLeagueHomeCopy = (leagueName) => {
  const raw = String(leagueName ?? '').trim()
  if (!raw) {
    return { title: '리그', subtitle: '이번 주 리그 순위를 확인해보세요!' }
  }

  const normalized = raw.replace(/\s*리그$/, '').trim()
  const upper = normalized.toUpperCase()
  return (
    LEAGUE_HOME_COPY[upper] ??
    LEAGUE_HOME_COPY[normalized] ?? {
      title: raw.endsWith('리그') ? raw : `${raw} 리그`,
      subtitle: '이번 주 리그 순위를 확인해보세요!',
    }
  )
}

function QuestCard({ quest, onClaim, isCelebrating = false }) {
  const isDone = quest.variant === 'done'
  const isReady = quest.variant === 'ready'
  const isPending = quest.variant === 'pending'
  const actionLabel = isReady || isPending ? `+${quest.reward ?? 0}XP` : '획득완료'
  return (
    <article className="relative flex min-h-[124px] flex-col justify-between rounded-[14px] border border-black/10 bg-white p-2.5 shadow-[0_4px_10px_rgba(15,23,42,0.05)]">
      <AnimatePresence>
        {isCelebrating ? (
          <motion.img
            key={`confetti-${quest.userQuestId ?? quest.title}`}
            alt=""
            aria-hidden
            className="pointer-events-none absolute -top-7 left-1/2 z-20 w-[94px] -translate-x-1/2 select-none"
            src="/codoc-confetti.png"
            initial={{ opacity: 0, scale: 0.75, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: -2 }}
            exit={{ opacity: 0, scale: 1.06, y: -18 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        ) : null}
      </AnimatePresence>
      <div className="space-y-2">
        <div
          className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full border-2 transition ${
            isDone ? 'border-[#3f3f46] bg-[#e5e7eb]' : 'border-[#bfc3c9] bg-[#f4f5f7]'
          }`}
        >
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-full border text-sm font-semibold ${
              isDone
                ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'
                : 'border-[#bfc3c9] bg-[#f4f5f7] text-[#9ca3af]'
            }`}
          >
            ✓
          </div>
        </div>
        <p
          className="text-center text-[14px] font-semibold leading-[1.35]"
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            wordBreak: 'keep-all',
            overflowWrap: 'normal',
            minHeight: '2.45em',
          }}
        >
          {quest.title}
        </p>
      </div>
      <button
        className={`mt-3 w-full rounded-xl px-3 py-2 text-[12px] font-semibold transition ${
          isDone
            ? 'bg-[#e5e7eb] text-[#6b7280]'
            : isReady
              ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary)/0.9)]'
              : 'border border-black/10 bg-white text-foreground'
        } disabled:cursor-not-allowed disabled:opacity-60`}
        disabled={quest.disabled}
        type="button"
        onClick={() => onClaim(quest.userQuestId)}
      >
        {actionLabel}
      </button>
    </article>
  )
}

export default function Home() {
  const navigate = useNavigate()
  const [quests, setQuests] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [recommendedProblem, setRecommendedProblem] = useState(null)
  const [isLoadingRecommend, setIsLoadingRecommend] = useState(true)
  const [recommendError, setRecommendError] = useState('')
  const [leagueInfo, setLeagueInfo] = useState(null)
  const [isLeagueBadgeImageFailed, setIsLeagueBadgeImageFailed] = useState(false)
  const [groupRank, setGroupRank] = useState(null)
  const [isLeaderboardLoading, setIsLeaderboardLoading] = useState(true)
  const [leaderboardError, setLeaderboardError] = useState('')
  const [celebratingQuestIds, setCelebratingQuestIds] = useState({})
  const [questPage, setQuestPage] = useState(0)
  const [surpriseQuiz, setSurpriseQuiz] = useState(null)
  const [isSurpriseQuizLoading, setIsSurpriseQuizLoading] = useState(true)
  const [isSurpriseQuizOpen, setIsSurpriseQuizOpen] = useState(false)
  const [selectedSurpriseChoiceNo, setSelectedSurpriseChoiceNo] = useState(null)
  const [surpriseSubmitError, setSurpriseSubmitError] = useState('')
  const [isSurpriseSubmitting, setIsSurpriseSubmitting] = useState(false)
  const [surpriseNow, setSurpriseNow] = useState(Date.now())
  const questTouchStartX = useRef(null)
  const questTouchLastX = useRef(null)
  const isRefreshingRef = useRef(false)

  const fetchSurpriseQuiz = useCallback(async () => {
    setIsSurpriseQuizLoading(true)

    try {
      const result = await getSurpriseQuiz()
      setSurpriseQuiz(result)
      setSelectedSurpriseChoiceNo(null)
      setSurpriseSubmitError('')
    } catch (error) {
      const errorCode = error?.response?.data?.code
      if (['SURPRISE_EVENT_NOT_OPEN', 'SURPRISE_EVENT_SUBMISSION_CLOSED'].includes(errorCode)) {
        setSurpriseQuiz(null)
      } else {
        setSurpriseQuiz(null)
      }
    } finally {
      setIsSurpriseQuizLoading(false)
    }
  }, [])

  const handleQuestRefresh = useCallback(async () => {
    if (isRefreshingRef.current) {
      return
    }
    isRefreshingRef.current = true
    setIsRefreshing(true)
    setLoadError('')
    setRecommendError('')
    try {
      await api.post('/api/user/quests/refresh', {})
      const [questRes] = await Promise.all([api.get('/api/user/quests')])
      let nextRecommended = null
      try {
        const recommendRes = await api.get('/api/problems/recommended')
        nextRecommended = recommendRes.data?.data?.problem ?? null
      } catch (error) {
        if (error?.response?.status === 404) {
          nextRecommended = null
        } else {
          setRecommendError('추천 문제를 불러오지 못했습니다.')
        }
      }
      const questItems = questRes.data?.data?.quests ?? []
      const mappedQuests = questItems.map((item) => {
        const statusMeta = statusCopy[item.status] ?? statusCopy.IN_PROGRESS
        return {
          userQuestId: item.userQuestId,
          title: item.title,
          reward: item.reward ?? 0,
          variant: statusMeta.variant,
          disabled: statusMeta.disabled,
        }
      })
      setQuests(mappedQuests)
      setRecommendedProblem(nextRecommended)
    } catch {
      setLoadError('퀘스트를 새로고침하지 못했습니다. 잠시 후 다시 시도해주세요.')
    } finally {
      isRefreshingRef.current = false
      setIsRefreshing(false)
    }
  }, [setLoadError, setQuests, setRecommendError, setRecommendedProblem])
  const celebrateTimeoutsRef = useRef({})

  useEffect(() => {
    let mounted = true

    const fetchRecommended = async () => {
      setIsLoadingRecommend(true)
      setRecommendError('')
      try {
        const response = await api.get('/api/problems/recommended')
        if (!mounted) {
          return
        }
        setRecommendedProblem(response.data?.data?.problem ?? null)
      } catch (error) {
        if (!mounted) {
          return
        }
        if (error?.response?.status === 404) {
          setRecommendedProblem(null)
          return
        }
        setRecommendedProblem(null)
        setRecommendError('추천 문제를 불러오지 못했습니다.')
      } finally {
        if (mounted) {
          setIsLoadingRecommend(false)
        }
      }
    }

    const fetchHome = async (options = {}) => {
      const { showLoading = true } = options
      if (showLoading) {
        setIsLoading(true)
      }
      setLoadError('')

      try {
        const [questRes] = await Promise.all([api.get('/api/user/quests')])

        if (!mounted) {
          return
        }

        const questItems = questRes.data?.data?.quests ?? []
        const mappedQuests = questItems.map((item) => {
          const statusMeta = statusCopy[item.status] ?? statusCopy.IN_PROGRESS
          return {
            userQuestId: item.userQuestId,
            title: item.title,
            reward: item.reward ?? 0,
            variant: statusMeta.variant,
            disabled: statusMeta.disabled,
          }
        })

        setQuests(mappedQuests)
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

    const fetchLeaderboard = async () => {
      setIsLeaderboardLoading(true)
      setLeaderboardError('')

      const [leagueResult, groupResult] = await Promise.allSettled([
        api.get('/api/user/league'),
        api.get('/api/user/leaderboards/group'),
      ])

      if (!mounted) {
        return
      }

      if (leagueResult.status === 'fulfilled') {
        setLeagueInfo(leagueResult.value.data?.data ?? null)
      } else {
        setLeagueInfo(null)
      }

      if (groupResult.status === 'fulfilled') {
        setGroupRank(groupResult.value.data?.data ?? null)
      } else {
        setGroupRank(null)
        const status = groupResult.reason?.response?.status
        setLeaderboardError(
          status === 403 ? '곧 리그가 시작됩니다!' : '코독보드 정보를 불러오지 못했습니다.',
        )
      }

      setIsLeaderboardLoading(false)
    }

    fetchHome()
    void handleQuestRefresh()
    fetchRecommended()
    fetchLeaderboard()
    fetchSurpriseQuiz()

    return () => {
      mounted = false
      Object.values(celebrateTimeoutsRef.current).forEach((timeoutId) => {
        clearTimeout(timeoutId)
      })
      celebrateTimeoutsRef.current = {}
    }
  }, [fetchSurpriseQuiz, handleQuestRefresh])

  useEffect(() => {
    if (!surpriseQuiz?.eventEndsAt) {
      return undefined
    }

    const timerId = window.setInterval(() => {
      setSurpriseNow(Date.now())
    }, 1000)

    return () => {
      clearInterval(timerId)
    }
  }, [surpriseQuiz?.eventEndsAt])

  const handleClaim = async (userQuestId) => {
    if (!userQuestId) {
      return
    }
    try {
      await api.post(`/api/user/quests/${userQuestId}`)
      setQuests((prev) =>
        prev.map((quest) =>
          quest.userQuestId === userQuestId ? { ...quest, variant: 'done', disabled: true } : quest,
        ),
      )
      setCelebratingQuestIds((prev) => ({ ...prev, [userQuestId]: true }))
      if (celebrateTimeoutsRef.current[userQuestId]) {
        clearTimeout(celebrateTimeoutsRef.current[userQuestId])
      }
      celebrateTimeoutsRef.current[userQuestId] = window.setTimeout(() => {
        setCelebratingQuestIds((prev) => {
          if (!prev[userQuestId]) {
            return prev
          }
          const next = { ...prev }
          delete next[userQuestId]
          return next
        })
        delete celebrateTimeoutsRef.current[userQuestId]
      }, 1000)
    } catch {
      setLoadError('보상 수령에 실패했습니다. 잠시 후 다시 시도해주세요.')
    }
  }

  const handleOpenRecommended = () => {
    const problemId = recommendedProblem?.problemId ?? recommendedProblem?.id
    if (!problemId) {
      return
    }
    navigate(`/problems/${problemId}`)
  }

  const handleOpenSurpriseQuiz = () => {
    if (!surpriseQuiz) {
      return
    }

    if (surpriseQuiz.submissionStatus === 'not_submitted' && isSurpriseQuizClosed) {
      return
    }

    if (surpriseQuiz.submissionStatus === 'not_submitted') {
      setSelectedSurpriseChoiceNo(null)
      setSurpriseSubmitError('')
    }
    setIsSurpriseQuizOpen(true)
  }

  const handleSubmitSurpriseQuiz = async () => {
    if (isSurpriseSubmitting) {
      return
    }

    if (!selectedSurpriseChoiceNo) {
      setSurpriseSubmitError('선택지를 골라주세요.')
      return
    }

    setIsSurpriseSubmitting(true)
    setSurpriseSubmitError('')

    try {
      await submitSurpriseQuiz({
        choiceNo: selectedSurpriseChoiceNo,
      })
      await fetchSurpriseQuiz()
      setIsSurpriseQuizOpen(false)
      setSelectedSurpriseChoiceNo(null)
    } catch (error) {
      const errorCode = error?.response?.data?.code
      if (errorCode === 'SURPRISE_QUIZ_ALREADY_SUBMITTED') {
        setSurpriseSubmitError('이미 제출한 기습퀴즈입니다.')
        await fetchSurpriseQuiz()
        setIsSurpriseQuizOpen(false)
      } else if (errorCode === 'SURPRISE_EVENT_SUBMISSION_CLOSED') {
        setSurpriseSubmitError('기습퀴즈 제출 시간이 종료되었습니다.')
        await fetchSurpriseQuiz()
      } else if (errorCode === 'SURPRISE_INVALID_CHOICE_NO') {
        setSurpriseSubmitError('선택지가 올바르지 않습니다. 다시 선택해주세요.')
      } else {
        setSurpriseSubmitError('기습퀴즈 제출에 실패했습니다. 잠시 후 다시 시도해주세요.')
      }
    } finally {
      setIsSurpriseSubmitting(false)
    }
  }

  const normalizedRecommendStatus = normalizeProblemStatus(recommendedProblem?.status)
  const recommendedStatus =
    STATUS_OPTIONS.find((option) => option.value === normalizedRecommendStatus) ?? null
  const isLeagueStartingSoon =
    typeof leaderboardError === 'string' && leaderboardError.includes('리그가 시작')
  const leagueBadgeImage = getLeagueBadgeImage(leagueInfo?.name ?? leagueInfo?.leagueName)
  const leagueHomeCopy = getLeagueHomeCopy(leagueInfo?.name ?? leagueInfo?.leagueName)

  useEffect(() => {
    setIsLeagueBadgeImageFailed(false)
  }, [leagueBadgeImage])

  const questItems = quests
  const hasQuestItems = questItems.length > 0
  const completedQuestCount = quests.filter((quest) => quest.variant === 'done').length
  const questPages = Math.max(1, Math.ceil(questItems.length / 3))
  const isQuestPaged = questItems.length > 3
  const questOffsetPct = Math.min(questPages - 1, questPage) * (100 / questPages)
  const remainingLabel = formatRemainingLabel(surpriseQuiz?.eventEndsAt)
  const isSurpriseQuizClosed = surpriseQuiz?.eventEndsAt
    ? new Date(surpriseQuiz.eventEndsAt).getTime() <= surpriseNow
    : false

  return (
    <div className="space-y-3">
      {!isSurpriseQuizLoading && surpriseQuiz ? (
        <section className="overflow-hidden rounded-[18px] border border-[#f0c36b] bg-[linear-gradient(120deg,#2b1904_0%,#6a3d00_32%,#f0a81a_100%)] shadow-[0_14px_30px_rgba(120,53,15,0.18)]">
          <button
            className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left"
            type="button"
            onClick={handleOpenSurpriseQuiz}
            disabled={surpriseQuiz.submissionStatus === 'not_submitted' && isSurpriseQuizClosed}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold tracking-[0.08em] text-[#fff3d6]">
                  SURPRISE QUIZ
                </span>
                <span className="rounded-full bg-[#ffe3a3] px-2 py-0.5 text-[10px] font-bold text-[#7c4700]">
                  LIVE
                </span>
              </div>
              <h2 className="mt-2 text-[18px] font-bold tracking-tight text-white">
                코독 기습퀴즈가 열렸습니다
              </h2>
              <p className="mt-1 text-[12px] leading-relaxed text-[#fff3d6]">
                {surpriseQuiz.submissionStatus === 'submitted'
                  ? surpriseQuiz.isCorrect
                    ? `정답 · ${surpriseQuiz.rank ? `${surpriseQuiz.rank}위` : '순위 집계 중'} · ${formatElapsedLabel(surpriseQuiz.elapsedMs)}`
                    : '오답 · 결과 확인하기'
                  : `남은 시간 ${remainingLabel} · 선착순 정답 순위 기록`}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="rounded-full bg-white/12 p-2 text-[#ffe7b2]">
                <AlarmClock className="h-4 w-4" aria-hidden />
              </span>
              <span className="text-xl font-semibold leading-none text-white">›</span>
            </div>
          </button>
        </section>
      ) : null}

      <section className="rounded-[16px] border border-black/5 bg-white p-3 shadow-[0_8px_18px_rgba(15,23,42,0.06)]">
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
              <h2 className="text-[18px] font-bold tracking-tight">오늘의_퀘스트</h2>
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
              <span className="rounded-full bg-black/5 px-3 py-1 text-[11px] font-medium text-muted-foreground">
                {hasQuestItems ? `${completedQuestCount} / ${questItems.length}` : '-'}
              </span>
            </div>
          </div>
          {loadError ? <StatusMessage tone="error">{loadError}</StatusMessage> : null}
          <div className="relative">
            {hasQuestItems ? (
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
                            isCelebrating={Boolean(celebratingQuestIds[quest.userQuestId])}
                          />
                        ))}
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : !isLoading ? (
              <div className="py-6 text-center">
                <StatusMessage>오늘의 퀘스트가 없습니다.</StatusMessage>
              </div>
            ) : null}
          </div>
          {isLoading ? <StatusMessage>불러오는 중...</StatusMessage> : null}
        </div>
      </section>

      <section className="rounded-[16px] border border-black/10 bg-white p-3 shadow-[0_8px_18px_rgba(15,23,42,0.06)]">
        <div className="relative">
          <span className="absolute right-0 top-0 shrink-0 rounded-full border border-[#c7d7ff] bg-[#edf3ff] px-3.5 py-1.5 text-[12px] font-bold leading-none text-[#3154a6]">
            AI 추천
          </span>
          <div className="pr-[106px]">
            <div className="flex items-center gap-2">
              <span className="text-[#4f7cf3]">
                <Sparkles className="h-4 w-4 fill-current" aria-hidden />
              </span>
              <h3 className="text-[16.5px] font-semibold leading-none tracking-tight">
                사용자 맞춤 추천 문제
              </h3>
            </div>
            <p className="relative left-1 top-0.5 mt-2.5 whitespace-nowrap text-[11px] font-medium tracking-[-0.01em] text-[#5b6f9e]">
              AI가 최근 풀이 기록을 분석하여 오늘 가장 효율적인 추천 문제를 골라드려요.
            </p>
          </div>
        </div>
        {isLoadingRecommend ? (
          <StatusMessage className="mt-3">추천 문제를 불러오는 중...</StatusMessage>
        ) : recommendError ? (
          <StatusMessage className="mt-3" tone="error">
            {recommendError}
          </StatusMessage>
        ) : recommendedProblem ? (
          <button className="mt-3 w-full text-left" type="button" onClick={handleOpenRecommended}>
            <div className="rounded-2xl border border-slate-300 bg-white p-3 shadow-[0_14px_28px_rgba(15,23,42,0.10)] transition hover:shadow-[0_18px_34px_rgba(15,23,42,0.14)]">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-semibold text-muted-foreground">
                    {(recommendedProblem.problemId ?? recommendedProblem.id) ? (
                      <Badge className="rounded-full border border-black/10 bg-white px-2.5 py-0.5 text-[10px] text-foreground">
                        {recommendedProblem.problemId ?? recommendedProblem.id}번
                      </Badge>
                    ) : null}
                    <Badge className="rounded-full border border-black/10 bg-white px-2.5 py-0.5 text-[10px] text-foreground/80">
                      {formatDifficultyLabel(recommendedProblem.difficulty)}
                    </Badge>
                    {recommendedStatus ? (
                      <Badge
                        className={`rounded-full px-2.5 py-0.5 text-[10px] ${
                          recommendedStatus.pillClass ?? 'bg-background text-foreground/80'
                        }`}
                      >
                        {recommendedStatus.label}
                      </Badge>
                    ) : null}
                  </div>
                  <h3 className="flex items-center gap-2 text-[16px] font-semibold text-foreground leading-snug">
                    {recommendedProblem.title}
                    {recommendedProblem.bookmarked ? (
                      <Star aria-label="북마크" className="h-4 w-4 fill-[#4f7cf3] text-[#4f7cf3]" />
                    ) : null}
                  </h3>
                </div>
                <span className="text-lg text-muted-foreground" aria-hidden>
                  ›
                </span>
              </div>

              <div className="mt-3 rounded-xl border border-[#d4ddf8] bg-[#f5f8ff] px-3 py-2.5">
                <p className="text-[12px] font-bold text-[#3154a6]">AI 추천 이유</p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-[#31415f]">
                  {recommendedProblem.reason ??
                    '최근 풀이 패턴을 기준으로 학습 효율이 높은 문제입니다.'}
                </p>
              </div>
            </div>
          </button>
        ) : (
          <div className="relative mt-3 rounded-2xl border border-slate-300 bg-white px-3 py-2 shadow-[0_14px_28px_rgba(15,23,42,0.10)]">
            <span className="absolute right-3 top-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
              데이터 없음
            </span>
            <h4 className="pr-20 text-[15px] font-semibold text-foreground">예시) 부분합</h4>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] font-semibold">
              <Badge className="rounded-full border border-black/10 bg-white px-2.5 py-0.5 text-[10px] text-foreground">
                1806번
              </Badge>
              <Badge className="rounded-full border border-black/10 bg-white px-2.5 py-0.5 text-[10px] text-foreground/80">
                중간
              </Badge>
            </div>

            <div className="mt-2 rounded-xl border border-[#d4ddf8] bg-[#f5f8ff] px-3 py-2.5">
              <p className="text-[12px] font-bold text-[#3154a6]">AI 추천 이유</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-[#31415f]">
                최근 슬라이딩 윈도우 유형 정답률이 낮아 보강 학습이 필요해 보여요.
              </p>
            </div>
          </div>
        )}
      </section>

      <section className="w-full rounded-[16px] border border-black/10 bg-white p-3 text-left shadow-[0_10px_20px_rgba(15,23,42,0.06)]">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-[17.5px] font-semibold tracking-tight">
            <span className="relative inline-flex h-4 w-4 items-center justify-center text-[#facc15]">
              <Trophy className="h-4 w-4" aria-hidden strokeWidth={2.2} />
              <Star
                className="pointer-events-none absolute top-[4px] h-2.5 w-2.5 fill-white text-[#facc15]"
                aria-hidden
                strokeWidth={2.2}
              />
            </span>
            코독보드
          </h3>
        </div>

        {isLeaderboardLoading ? (
          <StatusMessage className="mt-3">코독보드를 불러오는 중...</StatusMessage>
        ) : leaderboardError ? (
          isLeagueStartingSoon ? (
            <div className="mt-3 rounded-xl border border-black/10 bg-[#f8f9fb] px-3 py-2.5">
              <p className="text-[14px] font-bold tracking-tight text-foreground">
                곧 리그가 시작됩니다!
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                리그 오픈 후 내 순위와 주간 XP가 표시돼요.
              </p>
            </div>
          ) : (
            <StatusMessage className="mt-3" tone="error">
              {leaderboardError}
            </StatusMessage>
          )
        ) : groupRank ? (
          <button
            className="mt-3 block w-full cursor-pointer text-left"
            type="button"
            onClick={() => navigate('/leaderboard')}
          >
            <div className="rounded-xl border border-black/10 bg-[#f8f9fb] p-3 transition hover:bg-[#f3f4f6]">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border border-black/10 bg-white text-[11px] font-semibold text-muted-foreground">
                    {leagueBadgeImage && !isLeagueBadgeImageFailed ? (
                      <img
                        alt="league badge"
                        className="h-full w-full object-cover"
                        src={leagueBadgeImage}
                        onError={() => setIsLeagueBadgeImageFailed(true)}
                      />
                    ) : leagueInfo?.logoUrl ? (
                      <img
                        alt="league logo"
                        className="h-full w-full object-cover"
                        src={leagueInfo.logoUrl}
                      />
                    ) : (
                      'L'
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-foreground">
                      {leagueHomeCopy.title}
                    </p>
                    <p className="mt-1 truncate text-[11px] font-medium text-muted-foreground">
                      {leagueHomeCopy.subtitle}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 text-lg leading-none text-muted-foreground">›</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-black/10 bg-white px-3 py-2">
                  <p className="text-[10px] font-semibold text-muted-foreground">내 순위</p>
                  <p className="mt-1 text-[14px] font-bold text-foreground">
                    #{groupRank.placeGroup ?? '-'}
                  </p>
                </div>
                <div className="rounded-lg border border-black/10 bg-white px-3 py-2">
                  <p className="text-[10px] font-semibold text-muted-foreground">주간 XP</p>
                  <p className="mt-1 text-[14px] font-bold text-foreground">
                    {(groupRank.weeklyXp ?? 0).toLocaleString('ko-KR')} XP
                  </p>
                </div>
              </div>
            </div>
          </button>
        ) : (
          <StatusMessage className="mt-3">코독보드 데이터를 준비하고 있어요.</StatusMessage>
        )}
      </section>

      <Dialog open={isSurpriseQuizOpen} onOpenChange={setIsSurpriseQuizOpen}>
        <DialogContent className="max-w-[390px] rounded-[24px] border-[#f3d596] bg-[#fffdf7] p-0">
          <div className="max-h-[calc(100dvh-2rem)] overflow-y-auto p-5">
            <DialogHeader>
              <DialogTitle className="text-[18px] font-bold tracking-tight text-[#5f3700]">
                코독 기습퀴즈
              </DialogTitle>
              <p className="mt-1 text-[12px] font-medium text-[#8a5a13]">{remainingLabel}</p>
            </DialogHeader>

            {surpriseQuiz?.quiz ? (
              <div className="mt-4 space-y-4">
                <div className="rounded-2xl border border-[#f4dfac] bg-white p-4 text-[14px] leading-relaxed text-foreground">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkBreaks, remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                    components={markdownComponents}
                  >
                    {surpriseQuiz.quiz.content}
                  </ReactMarkdown>
                </div>

                <div className="space-y-2.5">
                  {surpriseQuiz.quiz.choices.map((choice) => {
                    const isSelected = selectedSurpriseChoiceNo === choice.choiceNo
                    return (
                      <button
                        key={choice.id}
                        className={`flex w-full items-start gap-3 rounded-2xl border px-3 py-3 text-left transition ${
                          isSelected
                            ? 'border-[#d18b00] bg-[#fff7db] shadow-[0_8px_16px_rgba(209,139,0,0.10)]'
                            : 'border-[#ead9b2] bg-white hover:border-[#d6b16f]'
                        } disabled:cursor-not-allowed disabled:opacity-60`}
                        type="button"
                        disabled={isSurpriseSubmitting}
                        onClick={() => {
                          setSelectedSurpriseChoiceNo(choice.choiceNo)
                          setSurpriseSubmitError('')
                        }}
                      >
                        <span
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                            isSelected ? 'bg-[#d18b00] text-white' : 'bg-[#f8edd3] text-[#8a5a13]'
                          }`}
                        >
                          {getChoiceLabel(choice.choiceNo)}
                        </span>
                        <span className="pt-1 text-[14px] font-medium leading-relaxed text-foreground">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm, remarkBreaks, remarkMath]}
                            rehypePlugins={[rehypeKatex]}
                            components={markdownComponents}
                          >
                            {choice.content}
                          </ReactMarkdown>
                        </span>
                      </button>
                    )
                  })}
                </div>

                {surpriseSubmitError ? (
                  <StatusMessage tone="error">{surpriseSubmitError}</StatusMessage>
                ) : null}

                <button
                  className="w-full rounded-2xl bg-[#1f2937] px-4 py-3 text-[14px] font-semibold text-white transition hover:bg-[#111827] disabled:cursor-not-allowed disabled:bg-[#cbd5e1]"
                  type="button"
                  disabled={isSurpriseSubmitting}
                  onClick={handleSubmitSurpriseQuiz}
                >
                  {isSurpriseSubmitting ? '제출 중...' : '답안 제출'}
                </button>
              </div>
            ) : surpriseQuiz?.submissionStatus === 'submitted' ? (
              <div className="mt-4 space-y-4">
                <div
                  className={`rounded-2xl border p-4 ${
                    surpriseQuiz.isCorrect
                      ? 'border-[#d7c38a] bg-[#fff7db]'
                      : 'border-[#f1c5c5] bg-[#fff5f5]'
                  }`}
                >
                  <p
                    className={`text-[16px] font-bold ${
                      surpriseQuiz.isCorrect ? 'text-[#7c4700]' : 'text-[#b42318]'
                    }`}
                  >
                    {surpriseQuiz.isCorrect ? '정답입니다' : '틀렸습니다'}
                  </p>
                  {surpriseQuiz.isCorrect ? (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div className="rounded-xl border border-[#ead9b2] bg-white px-3 py-2">
                        <p className="text-[11px] font-semibold text-[#a16207]">등수</p>
                        <p className="mt-1 text-[15px] font-bold text-[#5f3700]">
                          {surpriseQuiz.rank ? `${surpriseQuiz.rank}위` : '집계 중'}
                        </p>
                      </div>
                      <div className="rounded-xl border border-[#ead9b2] bg-white px-3 py-2">
                        <p className="text-[11px] font-semibold text-[#a16207]">걸린 시간</p>
                        <p className="mt-1 text-[15px] font-bold text-[#5f3700]">
                          {formatElapsedLabel(surpriseQuiz.elapsedMs)}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-2 text-[13px] leading-relaxed text-[#b42318]">
                      이번 기습퀴즈는 오답 처리되었습니다.
                    </p>
                  )}
                </div>

                <button
                  className="w-full rounded-2xl bg-[#1f2937] px-4 py-3 text-[14px] font-semibold text-white transition hover:bg-[#111827]"
                  type="button"
                  onClick={() => setIsSurpriseQuizOpen(false)}
                >
                  확인
                </button>
              </div>
            ) : (
              <StatusMessage className="mt-4">기습퀴즈 정보를 준비 중입니다.</StatusMessage>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
