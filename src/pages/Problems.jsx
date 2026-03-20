import { ArrowUp, ChevronDown, Search, SlidersHorizontal, Star } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import StatusMessage from '@/components/StatusMessage'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { formatDifficultyLabel } from '@/constants/difficulty'
import { STATUS_OPTIONS } from '@/constants/problemStatusOptions'
import { consumeProblemListUpdates } from '@/lib/problemListUpdates'
import { cn } from '@/lib/utils'
import { getProblemList } from '@/services/problems/problemsService'

const DIFFICULTY_OPTIONS = [1, 2, 3, 4, 5]

const EMPTY_FILTERS = {
  status: [],
  difficulties: [],
  bookmarks: [],
}

const BOOKMARK_VALUE = 'bookmarked'
const PAGE_SIZE = 20
const AUTO_LOAD_DELAY_MS = 0
const SCROLL_Y_KEY = 'problems:scrollY'
const RESTORE_KEY = 'problems:restore'
const LIST_STATE_KEY = 'problems:listState'

export default function Problems() {
  const shouldRestore = typeof window !== 'undefined' && sessionStorage.getItem(RESTORE_KEY) === '1'
  const [searchValue, setSearchValue] = useState('')
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTERS)
  const [problems, setProblems] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [loadError, setLoadError] = useState(null)
  const [loadMoreError, setLoadMoreError] = useState(null)
  const [nextCursor, setNextCursor] = useState(null)
  const [hasNextPage, setHasNextPage] = useState(false)
  const [committedQuery, setCommittedQuery] = useState('')
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false)
  const [isAtTop, setIsAtTop] = useState(true)
  const listRestoredRef = useRef(false)
  const scrollRestoredRef = useRef(false)
  const isRevalidatingRef = useRef(false)
  const [isRestored, setIsRestored] = useState(shouldRestore)

  useEffect(() => {
    if (!shouldRestore || listRestoredRef.current) {
      return
    }

    try {
      const raw = sessionStorage.getItem(LIST_STATE_KEY)
      if (!raw) {
        setIsRestored(false)
        return
      }
      const stored = JSON.parse(raw)
      if (stored?.problems) {
        setProblems(stored.problems)
      }
      if (stored?.nextCursor !== undefined) {
        setNextCursor(stored.nextCursor)
      }
      if (stored?.hasNextPage !== undefined) {
        setHasNextPage(Boolean(stored.hasNextPage))
      }
      if (stored?.appliedFilters) {
        setAppliedFilters(stored.appliedFilters)
      }
      if (stored?.committedQuery !== undefined) {
        setCommittedQuery(stored.committedQuery)
      }
      if (stored?.searchValue !== undefined) {
        setSearchValue(stored.searchValue)
      }
      setLoadError(null)
      setLoadMoreError(null)
      setIsLoading(false)
      listRestoredRef.current = true
      sessionStorage.removeItem(LIST_STATE_KEY)
    } catch {
      listRestoredRef.current = true
      setIsRestored(false)
    }
  }, [shouldRestore])

  useEffect(() => {
    if (isRestored) {
      return
    }
    let isActive = true

    const fetchProblems = async () => {
      setIsLoading(true)
      setLoadError(null)
      setLoadMoreError(null)

      try {
        const {
          items,
          nextCursor: newCursor,
          hasNextPage: nextPage,
        } = await getProblemList({
          limit: PAGE_SIZE,
          query: committedQuery || undefined,
          difficulties: appliedFilters.difficulties,
          statuses: appliedFilters.status,
          bookmarked: appliedFilters.bookmarks.includes(BOOKMARK_VALUE),
        })
        if (isActive) {
          setProblems(items)
          setNextCursor(newCursor)
          setHasNextPage(nextPage)
        }
      } catch {
        if (isActive) {
          setLoadError('문제 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.')
          setProblems([])
          setNextCursor(null)
          setHasNextPage(false)
        }
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    fetchProblems()

    return () => {
      isActive = false
    }
  }, [appliedFilters, committedQuery, isRestored])

  const loadMoreSentinelRef = useRef(null)
  const loadMoreTimerRef = useRef(null)

  const handleLoadMore = useCallback(async () => {
    if (!hasNextPage || isLoadingMore) {
      return
    }

    setIsLoadingMore(true)
    setLoadMoreError(null)

    try {
      const {
        items,
        nextCursor: newCursor,
        hasNextPage: nextPage,
      } = await getProblemList({
        limit: PAGE_SIZE,
        cursor: nextCursor,
        query: committedQuery || undefined,
        difficulties: appliedFilters.difficulties,
        statuses: appliedFilters.status,
        bookmarked: appliedFilters.bookmarks.includes(BOOKMARK_VALUE),
      })
      setProblems((prev) => [...prev, ...items])
      setNextCursor(newCursor)
      setHasNextPage(nextPage)
    } catch {
      setLoadMoreError('추가 문제를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.')
    } finally {
      setIsLoadingMore(false)
    }
  }, [appliedFilters, committedQuery, hasNextPage, isLoadingMore, nextCursor])

  const visibleProblems = useMemo(() => problems, [problems])

  const getQuickFilterButtonClass = (isSelected) =>
    cn(
      'h-8 rounded-full border px-3 text-xs font-semibold',
      isSelected
        ? 'border-[#c9d8ff] bg-[#eef3ff] text-[#2f4f9f] hover:bg-[#e5edff]'
        : 'border-black/10 bg-white text-muted-foreground hover:bg-muted/70',
    )

  const getDifficultyButtonClass = (isSelected) =>
    cn(
      'h-8 rounded-full border px-3 text-xs font-semibold',
      isSelected
        ? 'border-[#c9d8ff] bg-[#eef3ff] text-[#2f4f9f] hover:bg-[#e5edff]'
        : 'border-black/10 bg-white text-muted-foreground hover:bg-muted/70',
    )

  const toggleAppliedFilter = (key, value) => {
    setIsRestored(false)
    setAppliedFilters((prev) => {
      const nextValues = prev[key].includes(value)
        ? prev[key].filter((item) => item !== value)
        : [...prev[key], value]
      return { ...prev, [key]: nextValues }
    })
  }

  const handleToggleBookmarkFilter = () => {
    setIsRestored(false)
    const nextBookmarks = appliedFilters.bookmarks.includes(BOOKMARK_VALUE) ? [] : [BOOKMARK_VALUE]
    setAppliedFilters((prev) => ({ ...prev, bookmarks: nextBookmarks }))
  }

  const handleClearDifficultyFilters = () => {
    setIsRestored(false)
    setAppliedFilters((prev) => ({ ...prev, difficulties: [] }))
  }

  const handleScrollTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  useEffect(() => {
    const getScrollTop = () =>
      window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0

    const handleScroll = () => {
      setIsAtTop(getScrollTop() <= 24)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()

    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  useEffect(() => {
    if (scrollRestoredRef.current || isLoading) {
      return
    }
    const shouldRestore = sessionStorage.getItem(RESTORE_KEY) === '1'
    if (!shouldRestore) {
      return
    }
    const savedY = Number(sessionStorage.getItem(SCROLL_Y_KEY) ?? 0)
    scrollRestoredRef.current = true
    sessionStorage.removeItem(RESTORE_KEY)
    sessionStorage.removeItem(SCROLL_Y_KEY)
    requestAnimationFrame(() => {
      window.scrollTo({ top: Number.isFinite(savedY) ? savedY : 0, behavior: 'auto' })
    })
  }, [isLoading, loadError, problems.length])

  const handleSearchSubmit = () => {
    setIsRestored(false)
    setCommittedQuery(searchValue.trim())
  }

  const activeFilterCount =
    appliedFilters.status.length +
    appliedFilters.bookmarks.length +
    appliedFilters.difficulties.length

  const revalidateList = useCallback(async () => {
    if (isRevalidatingRef.current) {
      return
    }
    isRevalidatingRef.current = true

    try {
      const {
        items,
        nextCursor: newCursor,
        hasNextPage: nextPage,
      } = await getProblemList({
        limit: PAGE_SIZE,
        query: committedQuery || undefined,
        difficulties: appliedFilters.difficulties,
        statuses: appliedFilters.status,
        bookmarked: appliedFilters.bookmarks.includes(BOOKMARK_VALUE),
      })
      setProblems(items)
      setNextCursor(newCursor)
      setHasNextPage(nextPage)
      setLoadError(null)
      setLoadMoreError(null)
    } catch {
      // Keep the current list if revalidation fails.
    } finally {
      isRevalidatingRef.current = false
    }
  }, [appliedFilters, committedQuery])

  useEffect(() => {
    if (isLoading) {
      return
    }
    const updates = consumeProblemListUpdates()
    if (!updates) {
      return
    }

    const shouldKeep = (problem) => {
      if (appliedFilters.bookmarks.includes(BOOKMARK_VALUE) && !problem.bookmarked) {
        return false
      }
      if (appliedFilters.status.length > 0 && !appliedFilters.status.includes(problem.status)) {
        return false
      }
      if (
        appliedFilters.difficulties.length > 0 &&
        !appliedFilters.difficulties.includes(problem.difficulty)
      ) {
        return false
      }
      return true
    }

    setProblems((prev) => {
      let didChange = false
      const next = prev
        .map((problem) => {
          const update = updates[String(problem.id)]
          if (!update) {
            return problem
          }
          didChange = true
          return { ...problem, ...update }
        })
        .filter(shouldKeep)

      return didChange ? next : prev
    })

    revalidateList()
  }, [appliedFilters, isLoading, revalidateList])

  useEffect(() => {
    const sentinel = loadMoreSentinelRef.current
    if (!sentinel || !hasNextPage || isLoading || isLoadingMore || loadError || loadMoreError) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          if (loadMoreTimerRef.current) {
            return
          }
          loadMoreTimerRef.current = window.setTimeout(() => {
            loadMoreTimerRef.current = null
            handleLoadMore()
          }, AUTO_LOAD_DELAY_MS)
        } else if (loadMoreTimerRef.current) {
          window.clearTimeout(loadMoreTimerRef.current)
          loadMoreTimerRef.current = null
        }
      },
      {
        root: null,
        rootMargin: '48px 0px',
        threshold: 0.4,
      },
    )

    observer.observe(sentinel)

    return () => {
      if (loadMoreTimerRef.current) {
        window.clearTimeout(loadMoreTimerRef.current)
        loadMoreTimerRef.current = null
      }
      observer.disconnect()
    }
  }, [handleLoadMore, hasNextPage, isLoading, isLoadingMore, loadError, loadMoreError])

  const handleOpenProblem = () => {
    sessionStorage.setItem(SCROLL_Y_KEY, String(window.scrollY))
    sessionStorage.setItem(RESTORE_KEY, '1')
    const listState = {
      problems,
      nextCursor,
      hasNextPage,
      appliedFilters,
      committedQuery,
      searchValue,
    }
    sessionStorage.setItem(LIST_STATE_KEY, JSON.stringify(listState))
  }

  return (
    <div className="space-y-5">
      <Card className="bg-muted/70">
        <CardHeader className="space-y-1.5 pb-2">
          <CardTitle>전체 문제</CardTitle>
          <CardDescription className="text-xs">
            코독이와 함께 다양한 문제를 풀어보세요
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-9 rounded-full border-0 pl-9 text-sm shadow-sm focus-visible:border focus-visible:border-black focus-visible:ring-0"
              onChange={(event) => setSearchValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  handleSearchSubmit()
                }
              }}
              placeholder="찾으시는 문제 제목을 적어주세요"
              type="text"
              value={searchValue}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Button
                aria-expanded={isFilterPanelOpen}
                className="h-8 rounded-full border-black/10 px-3 text-xs"
                onClick={() => setIsFilterPanelOpen((prev) => !prev)}
                size="sm"
                type="button"
                variant="outline"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                필터
                {activeFilterCount > 0 ? (
                  <span className="rounded-full bg-[#eef3ff] px-1.5 py-0 text-[10px] font-bold text-[#2f4f9f]">
                    {activeFilterCount}
                  </span>
                ) : null}
                <ChevronDown
                  className={cn(
                    'h-3.5 w-3.5 transition-transform',
                    isFilterPanelOpen ? 'rotate-180' : '',
                  )}
                />
              </Button>

              {activeFilterCount > 0 ? (
                <p className="text-[11px] font-medium text-muted-foreground">
                  적용됨: {activeFilterCount}
                </p>
              ) : null}
            </div>

            {isFilterPanelOpen ? (
              <div className="rounded-xl border border-black/10 bg-white p-3">
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-foreground">상태</p>
                    <div className="flex flex-wrap gap-1.5">
                      {STATUS_OPTIONS.map((option) => (
                        <Button
                          key={option.value}
                          className={getQuickFilterButtonClass(
                            appliedFilters.status.includes(option.value),
                          )}
                          onClick={() => toggleAppliedFilter('status', option.value)}
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          {option.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-foreground">기타</p>
                    <Button
                      className={getQuickFilterButtonClass(
                        appliedFilters.bookmarks.includes(BOOKMARK_VALUE),
                      )}
                      onClick={handleToggleBookmarkFilter}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      북마크
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <section className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <p className="text-sm font-semibold text-foreground">난이도</p>
          <p className="text-xs text-muted-foreground">레벨별로 바로 보기</p>
        </div>
        <div className="rounded-xl border border-black/10 bg-white p-2.5 shadow-sm">
          <div className="flex flex-wrap gap-1.5">
            <Button
              className={getDifficultyButtonClass(appliedFilters.difficulties.length === 0)}
              onClick={handleClearDifficultyFilters}
              size="sm"
              type="button"
              variant="outline"
            >
              전체
            </Button>
            {DIFFICULTY_OPTIONS.map((difficulty) => (
              <Button
                key={difficulty}
                className={getDifficultyButtonClass(
                  appliedFilters.difficulties.includes(difficulty),
                )}
                onClick={() => toggleAppliedFilter('difficulties', difficulty)}
                size="sm"
                type="button"
                variant="outline"
              >
                Lv. {difficulty}
              </Button>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        {isLoading ? (
          <Card className="border-dashed border-muted-foreground/40 bg-muted/40 p-6 text-center">
            <StatusMessage>문제를 불러오는 중입니다.</StatusMessage>
          </Card>
        ) : loadError ? (
          <Card className="border-dashed border-muted-foreground/40 bg-muted/40 p-6 text-center">
            <StatusMessage tone="error">{loadError}</StatusMessage>
          </Card>
        ) : (
          <>
            {visibleProblems.map((problem) => {
              const statusOption = STATUS_OPTIONS.find((option) => option.value === problem.status)

              return (
                <Link
                  key={problem.id}
                  className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20"
                  aria-label={`${problem.title} 상세 보기`}
                  onClick={handleOpenProblem}
                  to={`/problems/${problem.id}`}
                >
                  <Card className="border-muted/60 bg-muted/70 shadow-sm transition hover:shadow-md">
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
                          {problem.title}
                          {problem.bookmarked ? (
                            <Star
                              aria-label="북마크"
                              className="h-4 w-4 fill-warning text-warning"
                            />
                          ) : null}
                        </h3>
                        <span className="text-lg text-muted-foreground">{'›'}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-muted-foreground">
                        {problem.id ? (
                          <Badge className="rounded-full border border-black/10 bg-white px-3 py-1 text-foreground">
                            {problem.id}번
                          </Badge>
                        ) : null}
                        <Badge className="rounded-full bg-background px-3 py-1 text-foreground/80">
                          {formatDifficultyLabel(problem.difficulty)}
                        </Badge>
                        {problem.status !== 'not_attempted' ? (
                          <Badge
                            className={`rounded-full px-3 py-1 ${
                              statusOption?.pillClass ?? 'bg-background text-foreground/80'
                            }`}
                          >
                            {statusOption?.label}
                          </Badge>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
            {visibleProblems.length === 0 ? (
              <Card className="border-dashed border-muted-foreground/40 bg-muted/40 p-6 text-center">
                <img
                  alt="문제 없음 코독"
                  className="mx-auto mb-3 h-24 w-24 object-contain mix-blend-multiply"
                  src="/images/problem.png"
                  onError={(event) => {
                    event.currentTarget.style.display = 'none'
                  }}
                />
                <StatusMessage>조건에 맞는 문제가 없습니다. 필터를 조정해보세요.</StatusMessage>
              </Card>
            ) : null}
            {loadMoreError ? (
              <Card className="border-dashed border-muted-foreground/40 bg-muted/40 p-4 text-center">
                <StatusMessage tone="error">{loadMoreError}</StatusMessage>
                <Button
                  className="mt-3"
                  disabled={isLoadingMore}
                  onClick={handleLoadMore}
                  type="button"
                  variant="outline"
                >
                  다시 시도
                </Button>
              </Card>
            ) : null}
            {isLoadingMore ? (
              <Card className="border-dashed border-muted-foreground/40 bg-muted/40 p-4 text-center">
                <StatusMessage>추가 문제를 불러오는 중입니다.</StatusMessage>
              </Card>
            ) : null}
            {hasNextPage ? (
              <div ref={loadMoreSentinelRef} aria-hidden="true" className="h-1 w-full" />
            ) : null}
          </>
        )}
      </section>

      {!isAtTop ? (
        <div className="pointer-events-none fixed bottom-24 left-1/2 z-20 w-full max-w-[430px] -translate-x-1/2 px-4">
          <div className="flex justify-end">
            <Button
              aria-label="맨 위로 이동"
              className="pointer-events-auto h-10 w-10 rounded-full border border-muted bg-background shadow-md"
              onClick={handleScrollTop}
              size="icon"
              type="button"
              variant="outline"
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
