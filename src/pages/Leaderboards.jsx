import { Crown, Globe, Star, Trophy, Users } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import StatusMessage from '@/components/StatusMessage'
import { getLeagueBadgeImage } from '@/constants/leagueBadges'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

const TAB_OPTIONS = [
  { id: 'group', label: '그룹', Icon: Users },
  { id: 'league', label: '리그', Icon: Crown },
  { id: 'global', label: '전체', Icon: Globe },
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

const LEAGUE_RULE_TONES = {
  브론즈: {
    rowClass: 'bg-[#fff8f3]',
    badgeClass: 'border-[#e5b17e] bg-[#f8dcc0] text-[#8a5221]',
  },
  실버: {
    rowClass: 'bg-[#f8fafc]',
    badgeClass: 'border-[#bfc8d6] bg-[#e8edf5] text-[#556274]',
  },
  골드: {
    rowClass: 'bg-[#fffdf2]',
    badgeClass: 'border-[#e4c252] bg-[#f9edb6] text-[#8f6a00]',
  },
  플래티넘: {
    rowClass: 'bg-[#f6fff5]',
    badgeClass: 'border-[#98cc8f] bg-[#dcf5d8] text-[#2f7b39]',
  },
  다이아몬드: {
    rowClass: 'bg-[#f3f9ff]',
    badgeClass: 'border-[#8ab6e8] bg-[#dcedff] text-[#2e5f95]',
  },
}

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
  date.setHours(0, 0, 0, 0)
  const diffMs = date.getTime() - now.getTime()
  if (diffMs <= 0) {
    return 0
  }
  return Math.ceil(diffMs / 86400000)
}

const getRankValue = (item, fallbackRank) =>
  item?.placeGroup ??
  item?.placeLeague ??
  item?.placeGlobal ??
  item?.rank ??
  item?.place ??
  fallbackRank

const getTopRankBadgeClass = (rankValue) => {
  const rank = Number(rankValue)
  if (!Number.isFinite(rank)) {
    return 'text-muted-foreground'
  }
  if (rank === 1) {
    return 'border-[#f0d27f] bg-[#fff8e5] text-[#8a6708]'
  }
  if (rank === 2) {
    return 'border-[#c8d2df] bg-[#f4f7fb] text-[#475569]'
  }
  if (rank === 3) {
    return 'border-[#c8d8f2] bg-[#f2f7ff] text-[#2f5f9b]'
  }
  return 'text-muted-foreground'
}

const getTopRankIcon = (rankValue) => {
  const rank = Number(rankValue)
  if (!Number.isFinite(rank)) {
    return null
  }
  if (rank === 1) {
    return Crown
  }
  if (rank === 2) {
    return Trophy
  }
  if (rank === 3) {
    return Star
  }
  return null
}

const getTopRankIconClass = (rankValue) => {
  const rank = Number(rankValue)
  if (rank === 1) {
    return 'text-[#c09300]'
  }
  if (rank === 2) {
    return 'text-[#64748b]'
  }
  if (rank === 3) {
    return 'text-[#3b82f6]'
  }
  return 'text-muted-foreground'
}

const renderRankLabel = (rankValue) => {
  const rank = Number(rankValue)
  const Icon = getTopRankIcon(rankValue)
  if (!Number.isFinite(rank) || !Icon) {
    return (
      <span className="w-fit justify-self-start font-semibold text-muted-foreground">
        #{rankValue}
      </span>
    )
  }
  return (
    <span
      className={cn(
        'inline-flex w-fit justify-self-start items-center gap-0.5 rounded-full border px-1.5 py-0 text-[12px] font-semibold',
        getTopRankBadgeClass(rankValue),
      )}
    >
      <Icon className={cn('h-3 w-3', getTopRankIconClass(rankValue))} aria-hidden />#{rankValue}
    </span>
  )
}

const getPinnedRankTextClass = (rankValue) => {
  const rank = Number(rankValue)
  if (Number.isFinite(rank) && rank <= 3) {
    if (rank === 1) {
      return 'text-[#8a6708]'
    }
    if (rank === 2) {
      return 'text-[#475569]'
    }
    return 'text-[#2f5f9b]'
  }
  return 'text-[#334155]'
}

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
  const [isLeagueNotStarted, setIsLeagueNotStarted] = useState(false)
  const [isLeagueBadgeImageFailed, setIsLeagueBadgeImageFailed] = useState(false)
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
      setIsLeagueNotStarted(false)
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
        if (status === 403) {
          setIsLeagueNotStarted(true)
          setLoadError('곧 리그가 시작됩니다!')
        } else {
          setLoadError('코독보드를 불러오지 못했습니다.')
        }
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
            setLoadMoreError('이전 코독보드를 불러오지 못했습니다.')
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
          setLoadMoreError('추가 코독보드를 불러오지 못했습니다.')
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
  const leagueBadgeImage = getLeagueBadgeImage(resolvedLeagueName)

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
  const showLeagueStartImage = Boolean(loadError) && isLeagueNotStarted
  const rankHeader = '주간 획득 경험치(XP)'
  const myRankValue = getRankValue(userRank, null)

  useEffect(() => {
    setIsLeagueBadgeImageFailed(false)
  }, [leagueBadgeImage])

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
      setLoadMoreError('상위 코독보드를 불러오지 못했습니다.')
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
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg border border-muted/70 bg-white text-[10px] font-semibold text-muted-foreground">
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
            <div className="truncate text-sm font-semibold">{resolvedLeagueName || '-'}</div>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <span>{seasonLabel || '시즌 일정 준비 중'}</span>
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

      <div className="overflow-hidden rounded-2xl border border-muted/60 bg-white shadow-[0_10px_24px_rgba(15,23,42,0.07)]">
        {showLeagueStartImage ? null : (
          <div className="grid min-w-0 grid-cols-[72px_72px_minmax(0,1fr)_88px] items-center border-b border-muted bg-muted/50 px-3 py-2 text-[11px] font-semibold text-muted-foreground">
            <span>순위</span>
            <span>프로필</span>
            <span>이용자</span>
            <span className="text-right">{rankHeader}</span>
          </div>
        )}

        {isLoading ? (
          <div className="p-6">
            <StatusMessage>코독보드를 불러오는 중...</StatusMessage>
          </div>
        ) : loadError ? (
          showLeagueStartImage ? (
            <div className="flex min-h-[380px] flex-col items-center justify-center px-6 py-8">
              <img
                alt="리그 시작 예정"
                className="w-full max-w-[420px] object-contain"
                src="https://images.codoc.cloud/images/leaderboard-coming.png"
                onError={(event) => {
                  event.currentTarget.style.display = 'none'
                }}
              />
              <p className="mt-3 text-center text-sm font-semibold text-muted-foreground">
                {loadError}
              </p>
            </div>
          ) : (
            <div className="p-6">
              <StatusMessage tone="error">{loadError}</StatusMessage>
            </div>
          )
        ) : isEmpty ? (
          <div className="p-6">
            <StatusMessage>코독보드 데이터가 없습니다.</StatusMessage>
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
              const isMyRow = Number.isFinite(myRankValue) && Number(rankValue) === myRankValue
              return (
                <div
                  id={`rank-row-${rankValue}`}
                  key={`${rankValue}-${item?.userId ?? item?.nickname ?? index}`}
                  className={cn(
                    'grid min-w-0 grid-cols-[72px_72px_minmax(0,1fr)_88px] items-center px-3 py-3 text-sm',
                    isMyRow ? 'border-y border-[#cfdbff] bg-[#eef3ff]' : '',
                  )}
                >
                  {renderRankLabel(rankValue)}
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
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm font-semibold text-foreground">
                      {item?.nickname ?? '-'}
                    </span>
                    {isMyRow ? (
                      <span className="shrink-0 rounded-full bg-[#4f7cf3] px-2 py-0.5 text-[10px] font-bold text-white">
                        MY
                      </span>
                    ) : null}
                  </div>
                  <span className="text-right text-sm font-semibold text-foreground truncate">
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
            className="pointer-events-auto w-full rounded-2xl bg-[#e8ecfa] px-3 py-3 text-left text-sm font-semibold text-[#1f2937] shadow-[0_14px_30px_rgba(15,23,42,0.14)] transition hover:bg-[#dfe5f7] disabled:cursor-not-allowed"
            onClick={handleJumpToMyRank}
            type="button"
            disabled={isJumpingToRank}
          >
            <div className="grid min-w-0 grid-cols-[72px_72px_minmax(0,1fr)_88px] items-center">
              <span
                className={cn('font-semibold', getPinnedRankTextClass(getRankValue(userRank, '-')))}
              >
                #{getRankValue(userRank, '-')}
              </span>
              <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-[#d7def3] text-[10px] font-semibold text-[#4b5563]">
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
              <span className="truncate text-[#0f172a]">{userRank.nickname ?? 'me'}</span>
              <span className="truncate text-right text-[#0f172a]">{userRank.weeklyXp ?? 0}</span>
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
                <img
                  alt="리그 안내 코독"
                  className="mx-auto h-20 w-20 object-contain"
                  src="https://images.codoc.cloud/images/leaderboard_codoc.png"
                  onError={(event) => {
                    event.currentTarget.style.display = 'none'
                  }}
                />
                <div className="mt-3 space-y-2 text-center">
                  <p className="text-base font-semibold">코독이 리그! 이렇게 즐겨보세요!</p>
                  <p className="text-sm text-muted-foreground">
                    문제를 풀면 XP를 받고
                    <br />
                    같은 리그의 30명이 한 그룹으로 순위를 겨뤄요!
                    <br />
                    순위는 XP 누적으로 결정됩니다!
                  </p>
                  <p className="rounded-md bg-muted/70 px-2 py-1 text-[11px] font-semibold text-foreground">
                    매주 화요일 01:00 시작 · 다음 주 월요일 00:00 종료 (KST)
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
                      className={cn(
                        'grid grid-cols-3 border-t border-muted/40 px-3 py-2 text-xs font-semibold text-foreground',
                        LEAGUE_RULE_TONES[rule.name]?.rowClass ?? '',
                      )}
                    >
                      <span>
                        <span
                          className={cn(
                            'inline-flex rounded-full border px-2 py-0.5',
                            LEAGUE_RULE_TONES[rule.name]?.badgeClass ??
                              'border-muted/50 bg-background',
                          )}
                        >
                          {rule.name}
                        </span>
                      </span>
                      <span>{rule.promote}</span>
                      <span>{rule.demote}</span>
                    </div>
                  ))}
                </div>

                <p className="mt-4 text-center text-xs font-semibold text-muted-foreground">
                  ※ 순위는 실시간 반영! 지금 풀면 바로 순위가 움직여요
                </p>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
