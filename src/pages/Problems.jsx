import { ArrowUp, Filter, RefreshCw, Search, Star } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import StatusMessage from '@/components/StatusMessage'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { formatDifficultyLabel } from '@/constants/difficulty'
import { STATUS_OPTIONS } from '@/constants/problemStatusOptions'
import { getProblemList } from '@/services/problems/problemsService'

const DIFFICULTY_OPTIONS = [1, 2, 3, 4, 5]

const EMPTY_FILTERS = {
  status: [],
  difficulties: [],
  bookmarks: [],
}

const BOOKMARK_VALUE = 'bookmarked'
const PAGE_SIZE = 20
const SCROLL_Y_KEY = 'problems:scrollY'
const RESTORE_KEY = 'problems:restore'
const LIST_STATE_KEY = 'problems:listState'

export default function Problems() {
  const shouldRestore = typeof window !== 'undefined' && sessionStorage.getItem(RESTORE_KEY) === '1'
  const [searchValue, setSearchValue] = useState('')
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [pendingFilters, setPendingFilters] = useState(EMPTY_FILTERS)
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTERS)
  const [problems, setProblems] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [loadError, setLoadError] = useState(null)
  const [loadMoreError, setLoadMoreError] = useState(null)
  const [nextCursor, setNextCursor] = useState(null)
  const [hasNextPage, setHasNextPage] = useState(false)
  const [committedQuery, setCommittedQuery] = useState('')
  const [isAtTop, setIsAtTop] = useState(true)
  const listRestoredRef = useRef(false)
  const scrollRestoredRef = useRef(false)
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
      if (stored?.pendingFilters) {
        setPendingFilters(stored.pendingFilters)
      } else if (stored?.appliedFilters) {
        setPendingFilters(stored.appliedFilters)
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

  const handleLoadMore = async () => {
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
  }

  const appliedTags = useMemo(() => {
    const statusTags = appliedFilters.status.map(
      (value) => `# ${STATUS_OPTIONS.find((option) => option.value === value)?.label ?? value}`,
    )
    const difficultyTags = appliedFilters.difficulties.map(
      (value) => `# ${formatDifficultyLabel(value)}`,
    )
    const bookmarkTags = appliedFilters.bookmarks.includes(BOOKMARK_VALUE) ? ['# 북마크'] : []

    return [...statusTags, ...difficultyTags, ...bookmarkTags]
  }, [appliedFilters])

  const visibleProblems = useMemo(() => problems, [problems])

  const togglePendingFilter = (key, value) => {
    setPendingFilters((prev) => {
      const nextValues = prev[key].includes(value)
        ? prev[key].filter((item) => item !== value)
        : [...prev[key], value]
      return { ...prev, [key]: nextValues }
    })
  }

  const handleApplyFilters = () => {
    setIsRestored(false)
    setAppliedFilters(pendingFilters)
    setIsFilterOpen(false)
  }

  const handleCancelFilters = () => {
    setPendingFilters(appliedFilters)
    setIsFilterOpen(false)
  }

  const handleResetFilters = () => {
    setIsRestored(false)
    setPendingFilters(EMPTY_FILTERS)
    setAppliedFilters(EMPTY_FILTERS)
  }

  const handleToggleBookmarkFilter = () => {
    setIsRestored(false)
    const nextBookmarks = appliedFilters.bookmarks.includes(BOOKMARK_VALUE) ? [] : [BOOKMARK_VALUE]
    setAppliedFilters((prev) => ({ ...prev, bookmarks: nextBookmarks }))
    setPendingFilters((prev) => ({ ...prev, bookmarks: nextBookmarks }))
  }

  const handleFilterOpenChange = (open) => {
    setPendingFilters(appliedFilters)
    setIsFilterOpen(open)
  }

  const handleScrollTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  useEffect(() => {
    const handleScroll = () => {
      setIsAtTop(window.scrollY <= 24)
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

  const handleOpenProblem = () => {
    sessionStorage.setItem(SCROLL_Y_KEY, String(window.scrollY))
    sessionStorage.setItem(RESTORE_KEY, '1')
    const listState = {
      problems,
      nextCursor,
      hasNextPage,
      appliedFilters,
      pendingFilters,
      committedQuery,
      searchValue,
    }
    sessionStorage.setItem(LIST_STATE_KEY, JSON.stringify(listState))
  }

  return (
    <Sheet open={isFilterOpen} onOpenChange={handleFilterOpenChange}>
      <div className="space-y-5">
        <Card className="bg-muted/70">
          <CardHeader>
            <CardTitle>전체 문제</CardTitle>
            <CardDescription>모든 문제를 확인하고 도전해보세요</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="rounded-full border-0 pl-9 shadow-sm focus-visible:border focus-visible:border-black focus-visible:ring-0"
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

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <SheetTrigger asChild>
                  <Button
                    className="gap-2 rounded-full border-foreground/20 px-4"
                    variant="outline"
                  >
                    필터
                    <Filter className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
                <Button
                  className={`gap-2 rounded-full px-4 ${
                    appliedFilters.bookmarks.includes(BOOKMARK_VALUE)
                      ? 'border-info bg-transparent hover:bg-info/10'
                      : 'border-foreground/20'
                  }`}
                  onClick={handleToggleBookmarkFilter}
                  type="button"
                  variant="outline"
                >
                  북마크
                </Button>
              </div>
              <Button
                className="gap-2 rounded-full px-3 text-xs"
                onClick={handleResetFilters}
                type="button"
                variant="ghost"
              >
                <RefreshCw className="h-4 w-4" />
                초기화
              </Button>
            </div>

            {appliedTags.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {appliedTags.map((tag) => (
                  <Badge
                    key={tag}
                    className="rounded-full bg-background text-foreground/80 shadow-sm"
                    variant="secondary"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            ) : (
              <StatusMessage>적용된 필터가 없습니다.</StatusMessage>
            )}
          </CardContent>
        </Card>

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
                const statusOption = STATUS_OPTIONS.find(
                  (option) => option.value === problem.status,
                )

                return (
                  <Link
                    key={problem.id}
                    className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20"
                    aria-label={`${problem.title} 상세 보기`}
                    onClick={handleOpenProblem}
                    to={`/problems/${problem.id}`}
                  >
                    <Card className="border-muted/60 bg-muted/70 shadow-sm transition hover:shadow-md">
                      <CardContent className="p-4">
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
                        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-semibold text-muted-foreground">
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
                  <StatusMessage>조건에 맞는 문제가 없습니다. 필터를 조정해보세요.</StatusMessage>
                </Card>
              ) : null}
              {loadMoreError ? (
                <Card className="border-dashed border-muted-foreground/40 bg-muted/40 p-4 text-center">
                  <StatusMessage tone="error">{loadMoreError}</StatusMessage>
                </Card>
              ) : null}
              {hasNextPage ? (
                <Button
                  className="w-full"
                  disabled={isLoadingMore}
                  onClick={handleLoadMore}
                  type="button"
                  variant="outline"
                >
                  {isLoadingMore ? '불러오는 중...' : '더 불러오기'}
                </Button>
              ) : null}
            </>
          )}
        </section>

        <SheetContent className="flex h-full w-[85%] max-w-[320px] flex-col gap-6">
          <SheetHeader>
            <div className="flex items-center justify-between">
              <SheetTitle>상태</SheetTitle>
            </div>
          </SheetHeader>
          <div className="space-y-2">
            {STATUS_OPTIONS.map((option) => {
              const id = `status-${option.value}`
              return (
                <label
                  key={option.value}
                  className="flex cursor-pointer items-center justify-between rounded-lg border border-muted bg-muted/30 px-3 py-2 text-sm select-none"
                  htmlFor={id}
                >
                  <span className="text-sm">{option.label}</span>
                  <Checkbox
                    checked={pendingFilters.status.includes(option.value)}
                    id={id}
                    onCheckedChange={() => togglePendingFilter('status', option.value)}
                  />
                </label>
              )
            })}
          </div>

          <div>
            <SheetTitle className="text-lg">난이도</SheetTitle>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {DIFFICULTY_OPTIONS.map((difficulty) => {
                const id = `difficulty-${difficulty}`
                return (
                  <label
                    key={difficulty}
                    className="flex cursor-pointer items-center justify-between rounded-lg border border-muted bg-muted/30 px-3 py-2 text-sm select-none"
                    htmlFor={id}
                  >
                    <span className="text-sm">Lv. {difficulty}</span>
                    <Checkbox
                      checked={pendingFilters.difficulties.includes(difficulty)}
                      id={id}
                      onCheckedChange={() => togglePendingFilter('difficulties', difficulty)}
                    />
                  </label>
                )
              })}
            </div>
          </div>

          <SheetFooter className="mt-auto grid grid-cols-2 gap-2 sm:flex">
            <Button onClick={handleCancelFilters} type="button" variant="secondary">
              취소
            </Button>
            <Button onClick={handleApplyFilters} type="button">
              적용
            </Button>
          </SheetFooter>
        </SheetContent>

        {!isAtTop ? (
          <Button
            aria-label="맨 위로 이동"
            className="fixed bottom-24 right-6 z-20 h-10 w-10 rounded-full border border-muted bg-background shadow-md"
            onClick={handleScrollTop}
            size="icon"
            type="button"
            variant="outline"
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
    </Sheet>
  )
}
