import { RefreshCw, Sparkles, Star } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { api } from '@/lib/api'
import StatusMessage from '@/components/StatusMessage'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { formatDifficultyLabel } from '@/constants/difficulty'
import { normalizeProblemStatus, STATUS_OPTIONS } from '@/constants/problemStatusOptions'

const statusCopy = {
  IN_PROGRESS: { variant: 'pending', disabled: true },
  COMPLETED: { variant: 'ready', disabled: false },
  CLAIMED: { variant: 'done', disabled: true },
}

function QuestCard({ quest, onClaim }) {
  const isDone = quest.variant === 'done'
  const isReady = quest.variant === 'ready'
  const isPending = quest.variant === 'pending'
  const actionLabel = isReady || isPending ? `+${quest.reward ?? 0}XP` : '획득완료'
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
                ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'
                : 'border-[#bfc3c9] bg-[#f4f5f7] text-[#9ca3af]'
            }`}
          >
            ✓
          </div>
        </div>
        <p
          className="text-center text-sm font-semibold leading-snug"
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            wordBreak: 'keep-all',
            overflowWrap: 'normal',
            minHeight: '2.6em',
          }}
        >
          {quest.title}
        </p>
      </div>
      <button
        className={`mt-4 w-full rounded-xl px-3 py-2 text-xs font-semibold transition ${
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
  const [groupRank, setGroupRank] = useState(null)
  const [isLeaderboardLoading, setIsLeaderboardLoading] = useState(true)
  const [leaderboardError, setLeaderboardError] = useState('')
  const [questPage, setQuestPage] = useState(0)
  const questTouchStartX = useRef(null)
  const questTouchLastX = useRef(null)
  const isRefreshingRef = useRef(false)

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
          status === 403 ? '곧 리그가 시작됩니다!' : '리더보드 정보를 불러오지 못했습니다.',
        )
      }

      setIsLeaderboardLoading(false)
    }

    fetchHome()
    void handleQuestRefresh()
    fetchRecommended()
    fetchLeaderboard()

    return () => {
      mounted = false
    }
  }, [handleQuestRefresh])

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

  const handleOpenRecommended = () => {
    if (!recommendedProblem?.problemId) {
      return
    }
    navigate(`/problems/${recommendedProblem.problemId}`)
  }

  const normalizedRecommendStatus = normalizeProblemStatus(recommendedProblem?.status)
  const recommendedStatus =
    STATUS_OPTIONS.find((option) => option.value === normalizedRecommendStatus) ?? null

  const questItems = quests
  const hasQuestItems = questItems.length > 0
  const completedQuestCount = quests.filter((quest) => quest.variant === 'done').length
  const questPages = Math.max(1, Math.ceil(questItems.length / 3))
  const isQuestPaged = questItems.length > 3
  const questOffsetPct = Math.min(questPages - 1, questPage) * (100 / questPages)

  return (
    <div className="space-y-4">
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

      <section className="rounded-[20px] border border-black/10 bg-white p-2.5 shadow-[0_10px_24px_rgba(15,23,42,0.07)]">
        <div className="flex items-center gap-2">
          <span className="text-[hsl(var(--warning))]">
            <Sparkles className="h-4 w-4 fill-current" aria-hidden />
          </span>
          <div>
            <h3 className="text-base font-semibold leading-none">나를 위한 AI 추천 문제</h3>
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
            <Card className="border-muted/60 bg-muted/70 shadow-sm transition hover:shadow-md">
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
                    {recommendedProblem.title}
                    {recommendedProblem.bookmarked ? (
                      <Star aria-label="북마크" className="h-4 w-4 fill-warning text-warning" />
                    ) : null}
                  </h3>
                  <span className="text-lg text-muted-foreground" aria-hidden>
                    ›
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-muted-foreground">
                  {(recommendedProblem.problemId ?? recommendedProblem.id) ? (
                    <Badge className="rounded-full border border-black/10 bg-white px-3 py-1 text-foreground">
                      {recommendedProblem.problemId ?? recommendedProblem.id}번
                    </Badge>
                  ) : null}
                  <Badge className="rounded-full bg-background px-3 py-1 text-foreground/80">
                    {formatDifficultyLabel(recommendedProblem.difficulty)}
                  </Badge>
                  {recommendedStatus ? (
                    <Badge
                      className={`rounded-full px-3 py-1 ${
                        recommendedStatus.pillClass ?? 'bg-background text-foreground/80'
                      }`}
                    >
                      {recommendedStatus.label}
                    </Badge>
                  ) : null}
                </div>
                {recommendedProblem.reason ? (
                  <p className="mt-2 text-base leading-relaxed text-foreground/80">
                    {recommendedProblem.reason}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          </button>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">추천 문제가 아직 준비되지 않았어요.</p>
        )}
      </section>

      <button
        className="w-full rounded-[22px] border border-black/10 bg-white px-4 py-4 text-left shadow-[0_12px_24px_rgba(15,23,42,0.08)] transition hover:bg-[#f7f8fa]"
        type="button"
        onClick={() => navigate('/leaderboard')}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">리더보드</h3>
          <span className="text-lg text-muted-foreground">›</span>
        </div>

        {isLeaderboardLoading ? (
          <StatusMessage className="mt-3">리더보드를 불러오는 중...</StatusMessage>
        ) : leaderboardError ? (
          <StatusMessage className="mt-3" tone="error">
            {leaderboardError}
          </StatusMessage>
        ) : groupRank ? (
          <div className="mt-3 flex items-center gap-4">
            <div className="flex h-[86px] w-[86px] items-center justify-center overflow-hidden rounded-[18px] border-2 border-muted-foreground/30 bg-white text-sm font-semibold text-muted-foreground">
              {leagueInfo?.logoUrl ? (
                <img
                  alt="league logo"
                  className="h-full w-full object-cover"
                  src={leagueInfo.logoUrl}
                />
              ) : (
                (leagueInfo?.name ?? 'LEAGUE').slice(0, 6)
              )}
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <span className="text-sm font-semibold text-foreground">
                주간 경험치: {groupRank.weeklyXp ?? 0}XP
              </span>
              <span className="text-sm font-semibold text-foreground">
                그룹 순위: {groupRank.placeGroup ?? '-'}
              </span>
            </div>
          </div>
        ) : (
          <StatusMessage className="mt-3">리더보드 데이터를 준비하고 있어요.</StatusMessage>
        )}
      </button>

      <div className="mt-3">
        <a
          className="block w-full rounded-xl border border-black/15 bg-white px-4 py-3 text-center text-sm font-semibold text-foreground shadow-sm transition hover:bg-[#f3f4f6]"
          href="https://docs.google.com/forms/d/e/1FAIpQLSd7MbHiijJHphq767m1eeHmpmqqA8XRzcDuG2TljsBKCR3yqQ/viewform?pli=1"
          target="_blank"
          rel="noreferrer"
        >
          사용자 피드백 설문
        </a>
      </div>
    </div>
  )
}
