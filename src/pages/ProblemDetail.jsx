import { BookOpen, Brain, Clover, Star } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import ProblemSummaryCards from '@/components/ProblemSummaryCards'
import { STATUS_OPTIONS } from '@/constants/problemStatusOptions'
import { getProblemDetail } from '@/services/problems/problemsService'

const TAB_ITEMS = [
  { id: 'problem', label: '문제', Icon: BookOpen },
  { id: 'chatbot', label: 'AI 챗봇', Icon: Brain },
  { id: 'quiz', label: '퀴즈', Icon: Clover },
]

const ACTIVE_TAB_ID = 'problem'

export default function ProblemDetail() {
  const { problemId } = useParams()
  const [problem, setProblem] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [isSummaryOpen, setIsSummaryOpen] = useState(false)

  useEffect(() => {
    let isActive = true

    const fetchProblem = async () => {
      if (!problemId) {
        if (isActive) {
          setLoadError('문제 정보를 찾을 수 없습니다.')
          setProblem(null)
          setIsLoading(false)
        }
        return
      }

      setIsLoading(true)
      setLoadError(null)

      try {
        const data = await getProblemDetail(problemId)
        if (isActive) {
          setProblem(data)
        }
      } catch {
        if (isActive) {
          setLoadError('문제 상세 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.')
          setProblem(null)
        }
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    fetchProblem()

    return () => {
      isActive = false
    }
  }, [problemId, reloadKey])

  useEffect(() => {
    setIsSummaryOpen(false)
  }, [problemId])

  const statusOption = useMemo(() => {
    if (!problem) {
      return null
    }

    return STATUS_OPTIONS.find((option) => option.value === problem.status) ?? null
  }, [problem])

  const handleStatusChange = (status) => {
    setProblem((prev) => (prev ? { ...prev, status } : prev))
  }

  const summaryCards = useMemo(() => problem?.summaryCards ?? [], [problem])
  const hasSummaryCards = summaryCards.length > 0

  const handleRetry = () => {
    setReloadKey((prev) => prev + 1)
  }

  return (
    <div className="space-y-5">
      {!isSummaryOpen ? (
        <div className="rounded-2xl bg-muted/70 px-2">
          <div className="grid grid-cols-3">
            {TAB_ITEMS.map((tab) => (
              <div
                key={tab.id}
                className={`flex flex-col items-center justify-center gap-1 px-3 py-3 text-xs font-semibold transition ${
                  tab.id === ACTIVE_TAB_ID ? 'text-foreground' : 'text-muted-foreground'
                }`}
              >
                <tab.Icon className="h-5 w-5" />
                {tab.label}
                <span
                  className={`mt-1 h-[2px] w-12 rounded-full ${
                    tab.id === ACTIVE_TAB_ID ? 'bg-foreground' : 'bg-transparent'
                  }`}
                />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {isLoading ? (
        <Card className="border-dashed border-muted-foreground/40 bg-muted/40 p-6 text-center">
          <p className="text-sm text-muted-foreground">문제 상세 정보를 불러오는 중입니다.</p>
        </Card>
      ) : loadError ? (
        <Card className="border-dashed border-muted-foreground/40 bg-muted/40 p-6 text-center">
          <p className="text-sm text-red-500">{loadError}</p>
          <Button className="mt-4" onClick={handleRetry} type="button" variant="secondary">
            다시 시도
          </Button>
        </Card>
      ) : problem ? (
        <>
          <div className="relative [perspective:1200px]">
            <div
              className={`relative transition-transform duration-500 [transform-style:preserve-3d] ${
                isSummaryOpen ? '[transform:rotateY(180deg)]' : ''
              }`}
            >
              <div className="space-y-5 [backface-visibility:hidden]">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-muted-foreground">
                    <Badge className="rounded-full bg-muted px-3 py-1 text-foreground/80">
                      Lv. {problem.level}
                    </Badge>
                    {problem.status !== 'not_attempted' ? (
                      <Badge
                        className={`rounded-full px-3 py-1 ${
                          statusOption?.pillClass ?? 'bg-background text-foreground/80'
                        }`}
                      >
                        {statusOption?.label ?? '상태 미정'}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold text-foreground">{problem.title}</h2>
                    <Star
                      aria-label={problem.bookmarked ? '북마크됨' : '북마크 안 됨'}
                      className={`h-5 w-5 ${
                        problem.bookmarked
                          ? 'fill-foreground text-foreground'
                          : 'text-muted-foreground'
                      }`}
                    />
                  </div>
                  <div className="h-px bg-border" />
                </div>

                <Button
                  className="w-full rounded-xl"
                  disabled={!hasSummaryCards}
                  onClick={() => setIsSummaryOpen(true)}
                  type="button"
                  variant="secondary"
                >
                  {hasSummaryCards ? '문제 요약 카드' : '요약 카드가 없습니다'}
                </Button>

                <section className="space-y-3">
                  {problem.content ? (
                    <ReactMarkdown
                      components={{
                        h1: ({ node: _node, ...props }) => (
                          <h3 className="text-base font-semibold text-foreground" {...props} />
                        ),
                        h2: ({ node: _node, ...props }) => (
                          <h3 className="text-base font-semibold text-foreground" {...props} />
                        ),
                        h3: ({ node: _node, ...props }) => (
                          <h4 className="text-sm font-semibold text-foreground" {...props} />
                        ),
                        h4: ({ node: _node, ...props }) => (
                          <h4 className="text-sm font-semibold text-foreground" {...props} />
                        ),

                        p: ({ node: _node, ...props }) => (
                          <p className="text-sm leading-relaxed text-foreground/90" {...props} />
                        ),

                        ul: ({ node: _node, ...props }) => (
                          <ul
                            className="list-disc space-y-1 pl-5 text-sm text-muted-foreground"
                            {...props}
                          />
                        ),

                        li: ({ node: _node, ...props }) => (
                          <li className="text-muted-foreground" {...props} />
                        ),

                        blockquote: ({ node: _node, ...props }) => (
                          <blockquote
                            className="rounded-xl bg-muted px-4 py-3 text-sm text-foreground/90"
                            {...props}
                          />
                        ),

                        pre: ({ node: _node, ...props }) => (
                          <pre
                            className="whitespace-pre-wrap rounded-xl bg-muted px-4 py-3 text-sm text-foreground/90"
                            {...props}
                          />
                        ),

                        code: ({ node: _node, inline, className, children, ...props }) => {
                          if (inline) {
                            return (
                              <code
                                className="rounded bg-muted/60 px-1 py-0.5 text-[0.85em] text-foreground/90"
                                {...props}
                              >
                                {children}
                              </code>
                            )
                          }

                          return (
                            <code className={className} {...props}>
                              {children}
                            </code>
                          )
                        },
                      }}
                    >
                      {problem.content}
                    </ReactMarkdown>
                  ) : (
                    <p className="text-sm text-muted-foreground">문제 설명이 없습니다.</p>
                  )}
                </section>
              </div>

              <div className="absolute inset-0 space-y-5 [backface-visibility:hidden] [transform:rotateY(180deg)]">
                <ProblemSummaryCards
                  problemId={problem.id}
                  summaryCards={summaryCards}
                  onClose={() => setIsSummaryOpen(false)}
                  onStatusChange={handleStatusChange}
                />
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
