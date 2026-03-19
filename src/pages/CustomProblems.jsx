import { ArrowUp, CircleHelp, Plus, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import CustomProblemCreateDialog from '@/components/CustomProblemCreateDialog'
import CustomProblemGuideDialog from '@/components/CustomProblemGuideDialog'
import StatusMessage from '@/components/StatusMessage'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  getCustomProblemList,
  deleteCustomProblem,
} from '@/services/customProblems/customProblemsService'

const PAGE_SIZE = 20

const STATUS_CONFIG = {
  processing: { label: '생성 중', pillClass: 'bg-info/20 text-info' },
  completed: { label: '완료', pillClass: 'bg-success/20 text-success' },
  failed: { label: '실패', pillClass: 'bg-danger/20 text-[hsl(var(--danger))]' },
}

const formatDate = (isoString) => {
  if (!isoString) {
    return ''
  }
  const date = new Date(isoString)
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`
}

export default function CustomProblems() {
  const [problems, setProblems] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [loadError, setLoadError] = useState(null)
  const [loadMoreError, setLoadMoreError] = useState(null)
  const [nextCursor, setNextCursor] = useState(null)
  const [hasNextPage, setHasNextPage] = useState(false)
  const [isAtTop, setIsAtTop] = useState(true)
  const [deletingId, setDeletingId] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteError, setDeleteError] = useState(null)
  const [isGuideOpen, setIsGuideOpen] = useState(false)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const loadMoreSentinelRef = useRef(null)

  const fetchProblems = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)
    setLoadMoreError(null)

    try {
      const result = await getCustomProblemList({ limit: PAGE_SIZE })
      setProblems(result.items)
      setNextCursor(result.nextCursor)
      setHasNextPage(result.hasNextPage)
    } catch {
      setLoadError('목록을 불러오지 못했습니다.')
      setProblems([])
      setNextCursor(null)
      setHasNextPage(false)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProblems()
  }, [fetchProblems])

  const handleLoadMore = useCallback(async () => {
    if (!hasNextPage || isLoadingMore) {
      return
    }

    setIsLoadingMore(true)
    setLoadMoreError(null)

    try {
      const result = await getCustomProblemList({ limit: PAGE_SIZE, cursor: nextCursor })
      setProblems((prev) => [...prev, ...result.items])
      setNextCursor(result.nextCursor)
      setHasNextPage(result.hasNextPage)
    } catch {
      setLoadMoreError('추가 항목을 불러오지 못했습니다.')
    } finally {
      setIsLoadingMore(false)
    }
  }, [hasNextPage, isLoadingMore, nextCursor])

  const handleDeleteClick = (event, problem) => {
    event.preventDefault()
    event.stopPropagation()

    if (deletingId) {
      return
    }

    setDeleteError(null)
    setDeleteTarget(problem)
  }

  const handleDeleteCancel = () => {
    if (deletingId) {
      return
    }

    setDeleteError(null)
    setDeleteTarget(null)
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget || deletingId) {
      return
    }

    setDeleteError(null)
    setDeletingId(deleteTarget.id)

    try {
      await deleteCustomProblem(deleteTarget.id)
      setProblems((prev) => prev.filter((problem) => problem.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch {
      setDeleteError('문제를 삭제하지 못했습니다. 잠시 후 다시 시도해주세요.')
    } finally {
      setDeletingId(null)
    }
  }

  useEffect(() => {
    const handleScroll = () => {
      setIsAtTop((window.scrollY || 0) <= 24)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    const sentinel = loadMoreSentinelRef.current
    if (!sentinel || !hasNextPage || isLoading || isLoadingMore || loadError || loadMoreError) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          handleLoadMore()
        }
      },
      { root: null, rootMargin: '48px 0px', threshold: 0.4 },
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [handleLoadMore, hasNextPage, isLoading, isLoadingMore, loadError, loadMoreError])

  return (
    <div className="space-y-5">
      <Card className="bg-muted/70">
        <CardHeader className="pb-0">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>나만의 문제</CardTitle>
            </div>
            <div className="flex gap-2">
              <Button
                aria-label="도움말"
                className="h-8 w-8 rounded-md border-foreground/20 p-0"
                onClick={() => setIsGuideOpen(true)}
                size="icon"
                type="button"
                variant="outline"
              >
                <CircleHelp className="h-4 w-4" />
              </Button>
              <Button
                aria-label="문제 만들기"
                className="h-8 w-8 rounded-md border-foreground/20 p-0"
                onClick={() => setIsCreateOpen(true)}
                size="icon"
                type="button"
                variant="outline"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-3">
          <CardDescription>문제 이미지를 업로드해 나만의 문제를 만들어보세요</CardDescription>
        </CardContent>
      </Card>

      <section className="space-y-4">
        {isLoading ? (
          <Card className="border-dashed border-muted-foreground/40 bg-muted/40 p-6 text-center">
            <StatusMessage>목록을 불러오는 중입니다.</StatusMessage>
          </Card>
        ) : loadError ? (
          <Card className="border-dashed border-muted-foreground/40 bg-muted/40 p-6 text-center">
            <StatusMessage tone="error">{loadError}</StatusMessage>
          </Card>
        ) : (
          <>
            {problems.map((problem) => {
              const statusConfig = STATUS_CONFIG[problem.status]
              const isCompleted = problem.status === 'completed'

              const cardContent = (
                <Card className="border-muted/60 bg-muted/70 shadow-sm transition hover:shadow-md">
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-base font-semibold text-foreground truncate">
                          {problem.title || '제목 없음'}
                        </h3>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-muted-foreground">
                          <Badge className="rounded-full bg-background px-3 py-1 text-foreground/80">
                            {formatDate(problem.createdAt)}
                          </Badge>
                          {statusConfig ? (
                            <Badge className={`rounded-full px-3 py-1 ${statusConfig.pillClass}`}>
                              {statusConfig.label}
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex items-center">
                        <Button
                          aria-label="삭제"
                          className="h-8 w-8 rounded-full text-muted-foreground hover:text-[hsl(var(--danger))]"
                          disabled={deletingId === problem.id}
                          onClick={(event) => handleDeleteClick(event, problem)}
                          size="icon"
                          type="button"
                          variant="ghost"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )

              return isCompleted ? (
                <Link
                  key={problem.id}
                  className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20"
                  to={`/custom-problems/${problem.id}`}
                >
                  {cardContent}
                </Link>
              ) : (
                <div key={problem.id}>{cardContent}</div>
              )
            })}

            {problems.length === 0 ? (
              <Card className="border-dashed border-muted-foreground/40 bg-muted/40 p-6 text-center">
                <StatusMessage>아직 생성된 나만의 문제가 없습니다.</StatusMessage>
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
                <StatusMessage>추가 항목을 불러오는 중입니다.</StatusMessage>
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
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              size="icon"
              type="button"
              variant="outline"
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}

      <CustomProblemCreateDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onCreated={fetchProblems}
      />
      <CustomProblemGuideDialog open={isGuideOpen} onOpenChange={setIsGuideOpen} />

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) {
            handleDeleteCancel()
          }
        }}
      >
        <DialogContent
          className="p-6"
          onEscapeKeyDown={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
          onPointerDownOutside={(event) => event.preventDefault()}
        >
          <div className="flex flex-col gap-5">
            <DialogHeader className="space-y-2 text-left">
              <DialogTitle>나만의 문제 삭제</DialogTitle>
              <DialogDescription>
                삭제하면 문제, 요약 카드, 퀴즈를 다시 볼 수 없습니다.
                <br />
                계속 진행하시겠어요?
              </DialogDescription>
            </DialogHeader>

            {deleteError ? <StatusMessage tone="error">{deleteError}</StatusMessage> : null}

            <DialogFooter className="flex-row justify-end gap-2">
              <Button
                disabled={Boolean(deletingId)}
                onClick={handleDeleteCancel}
                type="button"
                variant="outline"
              >
                취소
              </Button>
              <Button disabled={Boolean(deletingId)} onClick={handleDeleteConfirm} type="button">
                {deletingId ? '삭제 중...' : '삭제'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
