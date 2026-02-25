import { Crown, Users } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import StatusMessage from '@/components/StatusMessage'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

const TAB_OPTIONS = [
  { id: 'group', label: '그룹', Icon: Users },
  { id: 'league', label: '리그', Icon: Crown },
  { id: 'global', label: '전체', Icon: Users },
]

const LIST_LIMIT = 50
const JUMP_RANGE = 20

const LEAGUE_RULES = [
  { name: '브론즈', promote: '상위 20명', demote: '-' },
  { name: '실버', promote: '상위 15명', demote: '하위 5명' },
  { name: '골드', promote: '상위 10명', demote: '하위 10명' },
  { name: '플래티넘', promote: '상위 10명', demote: '하위 10명' },
  { name: '다이아몬드', promote: '-', demote: '하위 10명' },
]

const formatSeasonDate = (value) => {
  if (!value) {
    return ''
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  })
}

const getDaysRemaining = (value) => {
  if (!value) {
    return null
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return null
  }
  const now = new Date()
  const diffMs = date.setHours(23, 59, 59, 999) - now.getTime()
  return Math.ceil(diffMs / 86400000)
}

const getRankValue = (item, fallbackRank) =>
  item?.placeGroup ??
  item?.placeLeague ??
  item?.placeGlobal ??
  item?.rank ??
  item?.place ??
  fallbackRank

const dedupeRanks = (existingRanks, incomingRanks) => {
  const existingValues = new Set(
    existingRanks
      .map((item, index) => getRankValue(item, index + 1))
      .filter((value) => Number.isFinite(value)),
  )

  return incomingRanks.filter((item, index) => {
    const value = getRankValue(item, index + 1)
    if (!Number.isFinite(value)) {
      return true
    }
    if (existingValues.has(value)) {
      return false
    }
    existingValues.add(value)
    return true
  })
}

const buildRows = ({ ranks, promote, demote, totalCount }) => {
  if (!Array.isArray(ranks) || ranks.length === 0) {
    return []
  }

  let demoteStart = null
  if (totalCount && demote > 0) {
    demoteStart = totalCount - demote + 1
  }

  const rows = []

  ranks.forEach((item) => {
    const rankValue = getRankValue(item, null)
    if (demoteStart && rankValue === demoteStart) {
      rows.push({ type: 'separator', label: '강등', variant: 'down' })
    }

    rows.push({ type: 'row', data: item })

    if (promote > 0 && rankValue === promote) {
      rows.push({ type: 'separator', label: '승급', variant: 'up' })
    }
  })

  return rows
}

export default function Leaderboards() {
  const [activeTab, setActiveTab] = useState('group')
  const [leagueInfo, setLeagueInfo] = useState(null)
  const [seasonInfo, setSeasonInfo] = useState(null)
  const [rankList, setRankList] = useState([])
  const [listMeta, setListMeta] = useState(null)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [isLoadingPrev, setIsLoadingPrev] = useState(false)
  const [loadMoreError, setLoadMoreError] = useState('')
  const [isJumpingToRank, setIsJumpingToRank] = useState(false)
  const [isJumpCooldown, setIsJumpCooldown] = useState(false)
  const [userRank, setUserRank] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [isHelpOpen, setIsHelpOpen] = useState(false)
  const [isAtTop, setIsAtTop] = useState(true)
  const [containerRect, setContainerRect] = useState({ left: 0, width: 0 })
  const pendingScrollRankRef = useRef(null)
  const inFlightNextStartRef = useRef(null)
  const inFlightPrevStartRef = useRef(null)
  const programmaticScrollRef = useRef(false)
  const suppressInfiniteScrollRef = useRef(false)

  useEffect(() => {
    let mounted = true

    const fetchLeagueInfo = async () => {
      try {
        const response = await api.get('/api/user/league')
        if (!mounted) {
          return
        }
        setLeagueInfo(response.data?.data ?? null)
      } catch {
        if (mounted) {
          setLeagueInfo(null)
        }
      }
    }

    const fetchSeasonInfo = async () => {
      try {
        const response = await api.get('/api/leaderboards/season')
        if (!mounted) {
          return
        }
        setSeasonInfo(response.data?.data ?? null)
      } catch {
        if (mounted) {
          setSeasonInfo(null)
        }
      }
    }

    fetchLeagueInfo()
    fetchSeasonInfo()

    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    let mounted = true

    const fetchLeaderboard = async () => {
      setIsLoading(true)
      setLoadError('')
      setLoadMoreError('')
      setRankList([])
      setUserRank(null)

      const listRequest = api.get(`/api/leaderboards/${activeTab}`, {
        params: {
          startRank: 1,
          limit: LIST_LIMIT,
        },
      })
      const userRequest = api.get(`/api/user/leaderboards/${activeTab}`)

      const [listResult, userResult] = await Promise.allSettled([listRequest, userRequest])

      if (!mounted) {
        return
      }

      if (listResult.status === 'fulfilled') {
        const payload = listResult.value.data?.data ?? {}
        setRankList(Array.isArray(payload.ranks) ? payload.ranks : [])
        setListMeta({
          startRank: payload.startRank ?? 1,
          endRank: payload.endRank ?? null,
          hasMore: Boolean(payload.hasMore),
        })
      } else {
        const status = listResult.reason?.response?.status
        setLoadError(
          status === 403 ? '리더보드에 참여 중이 아닙니다.' : '리더보드를 불러오지 못했습니다.',
        )
      }

      if (userResult.status === 'fulfilled') {
        setUserRank(userResult.value.data?.data ?? null)
      } else {
        setUserRank(null)
      }

      setIsLoading(false)
    }

    fetchLeaderboard()

    return () => {
      mounted = false
    }
  }, [activeTab])

  useEffect(() => {
    const handleScroll = () => {
      const isNearTop = window.scrollY <= 24
      setIsAtTop(isNearTop)
      if (!isNearTop && !programmaticScrollRef.current) {
        suppressInfiniteScrollRef.current = false
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()

    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  useEffect(() => {
    const previousHtmlOverflow = document.documentElement.style.overflow
    const previousBodyOverflow = document.body.style.overflow
    const previousBodyPaddingRight = document.body.style.paddingRight

    if (!isHelpOpen) {
      document.documentElement.style.overflow = 'auto'
      document.body.style.overflow = 'auto'
      document.body.style.paddingRight = previousBodyPaddingRight
      return () => {
        document.documentElement.style.overflow = previousHtmlOverflow
        document.body.style.overflow = previousBodyOverflow
        document.body.style.paddingRight = previousBodyPaddingRight
      }
    }

    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`
    }
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow
      document.body.style.overflow = previousBodyOverflow
      document.body.style.paddingRight = previousBodyPaddingRight
    }
  }, [isHelpOpen])

  useEffect(() => {
    const updateRect = () => {
      const container = document.querySelector('[data-shell="app"]')
      if (!container) {
        return
      }
      const rect = container.getBoundingClientRect()
      const padding = 16
      setContainerRect({
        left: rect.left + padding,
        width: Math.max(0, rect.width - padding * 2),
      })
    }

    updateRect()

    const container = document.querySelector('[data-shell="app"]')
    let observer = null
    if (container && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(updateRect)
      observer.observe(container)
    }

    window.addEventListener('resize', updateRect)
    return () => {
      window.removeEventListener('resize', updateRect)
      if (observer) {
        observer.disconnect()
      }
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'group') {
      return
    }

    const handleScroll = () => {
      if (
        isLoading ||
        isLoadingMore ||
        isLoadingPrev ||
        isJumpingToRank ||
        isJumpCooldown ||
        programmaticScrollRef.current ||
        suppressInfiniteScrollRef.current ||
        loadError
      ) {
        return
      }
      if (listMeta?.startRank && listMeta.startRank > 1 && window.scrollY <= 200) {
        const currentStart = listMeta.startRank
        const prevStart = Math.max(1, currentStart - LIST_LIMIT)
        if (prevStart === currentStart) {
          return
        }
        if (inFlightPrevStartRef.current === prevStart) {
          return
        }

        setIsLoadingPrev(true)
        setLoadMoreError('')
        inFlightPrevStartRef.current = prevStart

        const prevHeight = document.documentElement.scrollHeight
        const prevScrollY = window.scrollY

        api
          .get(`/api/leaderboards/${activeTab}`, {
            params: {
              startRank: prevStart,
              limit: LIST_LIMIT,
            },
          })
          .then((response) => {
            const payload = response.data?.data ?? {}
            const nextRanks = Array.isArray(payload.ranks) ? payload.ranks : []
            setRankList((prev) => [...dedupeRanks(prev, nextRanks), ...prev])
            setListMeta({
              startRank: payload.startRank ?? prevStart,
              endRank: listMeta.endRank ?? payload.endRank ?? currentStart - 1,
              hasMore: Boolean(listMeta.hasMore ?? payload.hasMore),
            })
            requestAnimationFrame(() => {
              const nextHeight = document.documentElement.scrollHeight
              window.scrollTo({ top: prevScrollY + (nextHeight - prevHeight), behavior: 'auto' })
            })
          })
          .catch(() => {
            setLoadMoreError('이전 리더보드를 불러오지 못했습니다.')
          })
          .finally(() => {
            setIsLoadingPrev(false)
            inFlightPrevStartRef.current = null
          })
        return
      }
      const scrollPosition = window.innerHeight + window.scrollY
      const pageHeight = document.documentElement.scrollHeight
      if (pageHeight - scrollPosition > 240) {
        return
      }

      if (!listMeta?.hasMore) {
        return
      }

      const nextStartRank = (listMeta.endRank ?? rankList.length) + 1
      if (!Number.isFinite(nextStartRank) || nextStartRank <= 0) {
        return
      }
      if (inFlightNextStartRef.current === nextStartRank) {
        return
      }

      setIsLoadingMore(true)
      setLoadMoreError('')
      inFlightNextStartRef.current = nextStartRank

      api
        .get(`/api/leaderboards/${activeTab}`, {
          params: {
            startRank: nextStartRank,
            limit: LIST_LIMIT,
          },
        })
        .then((response) => {
          const payload = response.data?.data ?? {}
          const nextRanks = Array.isArray(payload.ranks) ? payload.ranks : []
          setRankList((prev) => [...prev, ...dedupeRanks(prev, nextRanks)])
          setListMeta({
            startRank: payload.startRank ?? nextStartRank,
            endRank: payload.endRank ?? listMeta.endRank ?? nextStartRank - 1,
            hasMore: Boolean(payload.hasMore),
          })
        })
        .catch(() => {
          setLoadMoreError('추가 리더보드를 불러오지 못했습니다.')
        })
        .finally(() => {
          setIsLoadingMore(false)
          inFlightNextStartRef.current = null
        })
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [
    activeTab,
    isJumpingToRank,
    isJumpCooldown,
    isLoading,
    isLoadingMore,
    isLoadingPrev,
    listMeta,
    loadError,
    rankList.length,
  ])

  const seasonLabel = useMemo(() => {
    if (!seasonInfo?.endsAt) {
      return ''
    }
    const dateLabel = formatSeasonDate(seasonInfo.endsAt)
    if (!dateLabel) {
      return ''
    }
    const daysRemaining = getDaysRemaining(seasonInfo.endsAt)
    if (daysRemaining === null) {
      return `${dateLabel} 종료`
    }
    if (daysRemaining <= 0) {
      return `${dateLabel} 종료`
    }
    return `${dateLabel} 종료 (지금으로부터 ${daysRemaining}일)`
  }, [seasonInfo?.endsAt])

  const resolvedLeagueName = leagueInfo?.name ?? leagueInfo?.leagueName ?? ''

  const leaderboardConfig = useMemo(() => {
    const promote = Number.isFinite(leagueInfo?.promoteTopN) ? leagueInfo.promoteTopN : 0
    const demote = Number.isFinite(leagueInfo?.demoteBottomN) ? leagueInfo.demoteBottomN : 0
    return { promote, demote }
  }, [leagueInfo?.demoteBottomN, leagueInfo?.promoteTopN])

  const totalCount = listMeta?.endRank ?? null
  const listRows = useMemo(() => {
    if (activeTab === 'global' || activeTab === 'league') {
      return rankList.map((item) => ({ type: 'row', data: item }))
    }
    return buildRows({
      ranks: rankList,
      promote: leaderboardConfig.promote,
      demote: leaderboardConfig.demote,
      totalCount,
    })
  }, [activeTab, leaderboardConfig.demote, leaderboardConfig.promote, rankList, totalCount])

  const isHeaderVisible = activeTab !== 'global'
  const isEmpty = !isLoading && !loadError && rankList.length === 0
  const rankHeader = '주간 획득 경험치(XP)'

  useEffect(() => {
    if (!pendingScrollRankRef.current) {
      return
    }
    const targetRank = pendingScrollRankRef.current
    const element = document.getElementById(`rank-row-${targetRank}`)
    if (!element) {
      return
    }
    pendingScrollRankRef.current = null
    requestAnimationFrame(() => {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }, [listRows])

  const handleJumpToMyRank = async () => {
    if (!userRank || isJumpingToRank) {
      return
    }
    const rankValue = getRankValue(userRank, null)
    if (!Number.isFinite(rankValue) || rankValue <= 0) {
      return
    }

    const startRank = Math.max(1, rankValue - JUMP_RANGE)
    const limit = JUMP_RANGE * 2 + 1

    setIsJumpingToRank(true)
    setLoadMoreError('')

    try {
      const response = await api.get(`/api/leaderboards/${activeTab}`, {
        params: { startRank, limit },
      })
      const payload = response.data?.data ?? {}
      setRankList(Array.isArray(payload.ranks) ? payload.ranks : [])
      setListMeta({
        startRank: payload.startRank ?? startRank,
        endRank: payload.endRank ?? startRank + limit - 1,
        hasMore: Boolean(payload.hasMore),
      })
      pendingScrollRankRef.current = rankValue
    } catch {
      setLoadMoreError('내 순위 주변을 불러오지 못했습니다.')
    } finally {
      setIsJumpingToRank(false)
      setIsJumpCooldown(true)
      window.setTimeout(() => {
        setIsJumpCooldown(false)
      }, 300)
    }
  }

  const handleJumpToTopRank = async () => {
    if (isJumpingToRank) {
      return
    }
    setIsJumpingToRank(true)
    setLoadMoreError('')
    suppressInfiniteScrollRef.current = true

    try {
      const response = await api.get(`/api/leaderboards/${activeTab}`, {
        params: {
          startRank: 1,
          limit: LIST_LIMIT,
        },
      })
      const payload = response.data?.data ?? {}
      setRankList(Array.isArray(payload.ranks) ? payload.ranks : [])
      setListMeta({
        startRank: payload.startRank ?? 1,
        endRank: payload.endRank ?? LIST_LIMIT,
        hasMore: Boolean(payload.hasMore),
      })
      pendingScrollRankRef.current = 1
    } catch {
      setLoadMoreError('상위 리더보드를 불러오지 못했습니다.')
    } finally {
      setIsJumpingToRank(false)
      setIsJumpCooldown(true)
      window.setTimeout(() => {
        setIsJumpCooldown(false)
      }, 800)
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-muted/70 px-2">
        <div className="grid grid-cols-3">
          {TAB_OPTIONS.map((tab) => (
            <button
              key={tab.id}
              className={cn(
                'flex flex-col items-center justify-center gap-1 px-3 py-3 text-xs font-semibold transition',
                tab.id === activeTab ? 'text-foreground' : 'text-neutral-500',
              )}
              onClick={() => setActiveTab(tab.id)}
              type="button"
            >
              <tab.Icon className="h-5 w-5" />
              {tab.label}
              <span
                className={cn(
                  'mt-1 h-[2px] w-12 rounded-full',
                  tab.id === activeTab ? 'bg-foreground' : 'bg-transparent',
                )}
              />
            </button>
          ))}
        </div>
      </div>

      {isHeaderVisible ? (
        <div className="flex items-center justify-between rounded-2xl bg-muted/60 px-4 py-3">
          <div className="text-sm font-semibold">{resolvedLeagueName || '-'}</div>
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <span>{seasonLabel || '시즌 정보 없음'}</span>
            <button
              aria-label="리그 제도 안내"
              className="inline-flex h-7 w-7 items-center justify-center rounded-full border-2 border-muted-foreground/50 text-base font-semibold text-muted-foreground"
              onClick={() => setIsHelpOpen(true)}
              type="button"
            >
              ?
            </button>
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-muted/60 bg-white shadow-[0_10px_24px_rgba(15,23,42,0.07)]">
        <div className="grid grid-cols-[64px_72px_1fr_88px] items-center border-b border-muted bg-muted/50 px-3 py-2 text-[11px] font-semibold text-muted-foreground">
          <span>순위</span>
          <span>프로필</span>
          <span>이용자</span>
          <span className="text-right">{rankHeader}</span>
        </div>

        {isLoading ? (
          <div className="p-6">
            <StatusMessage>리더보드를 불러오는 중...</StatusMessage>
          </div>
        ) : loadError ? (
          <div className="p-6">
            <StatusMessage tone="error">{loadError}</StatusMessage>
          </div>
        ) : isEmpty ? (
          <div className="p-6">
            <StatusMessage>리더보드 데이터가 없습니다.</StatusMessage>
          </div>
        ) : (
          <div className="divide-y divide-muted/40">
            {listRows.map((row, index) => {
              if (row.type === 'separator') {
                return (
                  <div
                    key={`${row.label}-${index}`}
                    className="flex items-center justify-between bg-muted/70 px-4 py-2 text-xs font-semibold text-muted-foreground"
                  >
                    <span>{row.variant === 'up' ? '↑' : '↓'}</span>
                    <span>{row.label}</span>
                    <span>{row.variant === 'up' ? '↑' : '↓'}</span>
                  </div>
                )
              }

              const item = row.data
              const rankValue = getRankValue(item, index + 1)
              return (
                <div
                  id={`rank-row-${rankValue}`}
                  key={`${rankValue}-${item?.userId ?? item?.nickname ?? index}`}
                  className="grid grid-cols-[64px_72px_1fr_88px] items-center px-3 py-3 text-sm"
                >
                  <span className="font-semibold text-muted-foreground">#{rankValue}</span>
                  <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-muted/60 text-[10px] font-semibold text-muted-foreground">
                    {item?.avatarUrl ? (
                      <img
                        alt="avatar"
                        className="h-full w-full object-cover"
                        src={item.avatarUrl}
                      />
                    ) : (
                      '프로필 아이콘'
                    )}
                  </div>
                  <span className="text-sm font-semibold text-foreground">
                    {item?.nickname ?? '-'}
                  </span>
                  <span className="text-right text-sm font-semibold text-foreground">
                    {item?.weeklyXp ?? 0}
                  </span>
                </div>
              )
            })}
            {loadMoreError ? (
              <div className="px-3 py-4">
                <StatusMessage tone="error">{loadMoreError}</StatusMessage>
              </div>
            ) : null}
            {isLoadingMore ? (
              <div className="px-3 py-4">
                <StatusMessage>추가 데이터를 불러오는 중...</StatusMessage>
              </div>
            ) : null}
            {isLoadingPrev ? (
              <div className="px-3 py-4">
                <StatusMessage>이전 데이터를 불러오는 중...</StatusMessage>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {userRank ? (
        <div
          className="pointer-events-none fixed z-20"
          style={{
            left: `${containerRect.left}px`,
            width: `${containerRect.width}px`,
            bottom: 'calc(var(--chatbot-input-bottom) + env(safe-area-inset-bottom))',
          }}
        >
          <button
            className="pointer-events-auto w-full rounded-2xl border border-muted/60 bg-muted/70 px-3 py-3 text-left text-sm font-semibold shadow-[0_10px_24px_rgba(15,23,42,0.07)] transition hover:bg-muted/80 disabled:cursor-not-allowed"
            onClick={handleJumpToMyRank}
            type="button"
            disabled={isJumpingToRank}
          >
            <div className="grid grid-cols-[64px_72px_1fr_88px] items-center">
              <span className="text-muted-foreground">#{getRankValue(userRank, '-')}</span>
              <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-muted/60 text-[10px] font-semibold text-muted-foreground">
                {userRank.avatarUrl ? (
                  <img
                    alt="avatar"
                    className="h-full w-full object-cover"
                    src={userRank.avatarUrl}
                  />
                ) : (
                  '프로필 아이콘'
                )}
              </div>
              <span className="text-foreground">{userRank.nickname ?? 'me'}</span>
              <span className="text-right text-foreground">{userRank.weeklyXp ?? 0}</span>
            </div>
          </button>
        </div>
      ) : null}

      {!isAtTop ? (
        <div className="pointer-events-none fixed bottom-40 left-1/2 z-20 w-full max-w-[430px] -translate-x-1/2 px-4">
          <div className="flex justify-end">
            <button
              aria-label="1등으로 이동"
              className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border border-muted bg-background shadow-md"
              onClick={() => {
                programmaticScrollRef.current = true
                handleJumpToTopRank()
                window.setTimeout(() => {
                  programmaticScrollRef.current = false
                }, 800)
              }}
              disabled={isJumpingToRank}
              type="button"
            >
              ↑
            </button>
          </div>
        </div>
      ) : null}

      {isHelpOpen
        ? createPortal(
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6"
              onClick={() => setIsHelpOpen(false)}
            >
              <div
                className="w-full max-w-[360px] rounded-2xl border border-black/10 bg-white p-5 shadow-[0_20px_50px_rgba(15,23,42,0.18)]"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="mt-3 space-y-2 text-center">
                  <p className="text-base font-semibold">경쟁하고 성장하세요!</p>
                  <p className="text-sm text-muted-foreground">
                    같은 리그의 30명이 그룹으로 일주일간 경쟁합니다.
                    <br />
                    매주 가장 크게 성장한 사람이 상위 리그로 진출합니다!
                    <br />
                    매주 화 01:00 시작 · 다음 주 월 00:00 종료 (KST)
                    <br />
                    리더보드는 매 정각 업데이트됩니다.
                  </p>
                </div>

                <div className="mt-4 overflow-hidden rounded-xl border border-muted">
                  <div className="grid grid-cols-3 bg-muted/70 px-3 py-2 text-xs font-semibold text-muted-foreground">
                    <span>리그</span>
                    <span>승격</span>
                    <span>강등</span>
                  </div>
                  {LEAGUE_RULES.map((rule) => (
                    <div
                      key={rule.name}
                      className="grid grid-cols-3 border-t border-muted/40 px-3 py-2 text-xs font-semibold text-foreground"
                    >
                      <span>{rule.name}</span>
                      <span>{rule.promote}</span>
                      <span>{rule.demote}</span>
                    </div>
                  ))}
                </div>

                <p className="mt-4 text-center text-xs font-semibold text-muted-foreground">
                  ※ 문제를 풀어 경험치를 쌓고 순위를 올려보세요
                </p>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
