import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BookOpen,
  Brain,
  Clover,
  Sparkles,
  Star,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'

import StatusMessage from '@/components/StatusMessage'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { formatDifficultyLabel } from '@/constants/difficulty'
import { STATUS_OPTIONS } from '@/constants/problemStatusOptions'
import {
  getProblemDetail,
  registerProblemBookmark,
  removeProblemBookmark,
} from '@/services/problems/problemsService'
import remarkGfm from 'remark-gfm'

const TAB_ITEMS = [
  { id: 'problem', label: '문제', Icon: BookOpen },
  { id: 'chatbot', label: 'AI 챗봇', Icon: Brain },
  { id: 'quiz', label: '퀴즈', Icon: Clover },
]

const ACTIVE_TAB_ID = 'problem'
const HELP_STEPS = [
  {
    id: 'summary',
    title: '문제 요약 카드',
    description: '문제 내용을 요약하는 퀴즈입니다.\n요약 카드를 해결해야 퀴즈를 풀 수 있어요.',
  },
  {
    id: 'chatbot',
    title: 'AI 챗봇',
    description:
      '문제에 대해 궁금한 점을 물어볼 수 있어요.\n단계가 있으며 현재 단계에 맞는 질문만 받을 수 있습니다.\nAI가 이해했다고 판단하면 다음 단계로 넘어갑니다.',
  },
  {
    id: 'quiz',
    title: '퀴즈',
    description:
      '알고리즘, 자료구조, 시간복잡도 관련 문제를 풉니다.\n모든 문제를 맞춰야 경험치를 얻을 수 있어요.',
  },
]

const splitWithLineBreaks = (children, keyPrefix = 'br') => {
  const list = Array.isArray(children) ? children : [children]
  return list.flatMap((child, index) => {
    if (typeof child !== 'string') {
      return child
    }
    const parts = child.split(/<br\s*\/?>/gi)
    return parts.flatMap((part, partIndex) => {
      if (partIndex === 0) {
        return part
      }
      return [<br key={`${keyPrefix}-${index}-${partIndex}`} />, part]
    })
  })
}

export default function ProblemDetail() {
  const { problemId } = useParams()
  const navigate = useNavigate()
  const [problem, setProblem] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [isBookmarking, setIsBookmarking] = useState(false)
  const [isAtTop, setIsAtTop] = useState(true)
  const [isHelpOpen, setIsHelpOpen] = useState(false)
  const [helpStepIndex, setHelpStepIndex] = useState(0)
  const [spotlightRect, setSpotlightRect] = useState(null)
  const [helpModalStyle, setHelpModalStyle] = useState({ top: 0, left: 0 })
  const summaryButtonRef = useRef(null)
  const chatbotTabRef = useRef(null)
  const quizTabRef = useRef(null)
  const helpModalRef = useRef(null)

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
      } catch (error) {
        if (isActive) {
          const status = error?.response?.status
          if (status === 404) {
            setLoadError('존재하지 않는 문제입니다.')
            window.alert('존재하지 않는 문제입니다.')
            navigate('/problems')
            return
          }
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
  }, [navigate, problemId, reloadKey])

  const statusOption = useMemo(() => {
    if (!problem) {
      return null
    }

    return STATUS_OPTIONS.find((option) => option.value === problem.status) ?? null
  }, [problem])

  const handleBookmarkToggle = async () => {
    if (!problem?.id || isBookmarking) {
      return
    }

    setIsBookmarking(true)

    try {
      const nextBookmarked = !problem.bookmarked
      const response = nextBookmarked
        ? await registerProblemBookmark(problem.id)
        : await removeProblemBookmark(problem.id)

      setProblem((prev) => (prev ? { ...prev, bookmarked: response.bookmarked } : prev))
    } finally {
      setIsBookmarking(false)
    }
  }

  const summaryCards = useMemo(() => problem?.summaryCards ?? [], [problem])
  const hasSummaryCards = summaryCards.length > 0

  const handleRetry = () => {
    setReloadKey((prev) => prev + 1)
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

  const currentHelpStep = HELP_STEPS[helpStepIndex]

  const getHelpTarget = useCallback((stepId) => {
    if (stepId === 'summary') {
      return summaryButtonRef.current
    }
    if (stepId === 'chatbot') {
      return chatbotTabRef.current
    }
    if (stepId === 'quiz') {
      return quizTabRef.current
    }
    return null
  }, [])

  const syncHelpPosition = useCallback(() => {
    if (!isHelpOpen || !currentHelpStep) {
      return
    }
    const target = getHelpTarget(currentHelpStep.id)
    if (!target) {
      return
    }

    const adjustedRect = target.getBoundingClientRect()
    const padding = 6
    const computedRadius = Number.parseFloat(window.getComputedStyle(target).borderRadius || '0')
    const maxRadius = (adjustedRect.height + padding * 2) / 2
    const safeRadius = Number.isNaN(computedRadius) ? 12 : computedRadius + padding / 2
    const offsetY = -20
    setSpotlightRect({
      top: Math.max(0, Math.round(adjustedRect.top - padding + offsetY)),
      left: Math.max(0, Math.round(adjustedRect.left - padding)),
      width: Math.round(adjustedRect.width + padding * 2),
      height: Math.round(adjustedRect.height + padding * 2),
      radius: Math.round(Math.min(maxRadius, Math.max(8, safeRadius))),
    })

    const modalEl = helpModalRef.current
    const modalRect = modalEl?.getBoundingClientRect()
    const modalWidth = modalRect?.width ?? 300
    const modalHeight = modalRect?.height ?? 160
    const spacing = 12
    let top = adjustedRect.bottom + spacing
    if (top + modalHeight > window.innerHeight - 12) {
      top = adjustedRect.top - spacing - modalHeight
    }
    let left = adjustedRect.left + adjustedRect.width / 2 - modalWidth / 2
    left = Math.max(12, Math.min(left, window.innerWidth - modalWidth - 12))
    top = Math.max(12, Math.min(top, window.innerHeight - modalHeight - 12))
    setHelpModalStyle({ top, left })
  }, [currentHelpStep, getHelpTarget, isHelpOpen])

  useLayoutEffect(() => {
    if (!isHelpOpen) {
      return
    }
    const target = getHelpTarget(currentHelpStep?.id)
    target?.scrollIntoView({ behavior: 'auto', block: 'center' })
    const raf = window.requestAnimationFrame(() => {
      syncHelpPosition()
      window.requestAnimationFrame(syncHelpPosition)
    })
    return () => window.cancelAnimationFrame(raf)
  }, [currentHelpStep?.id, getHelpTarget, helpStepIndex, isHelpOpen, syncHelpPosition])

  useEffect(() => {
    if (!isHelpOpen) {
      return
    }
    const handleScroll = () => syncHelpPosition()
    const handleResize = () => syncHelpPosition()
    window.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleResize)
    }
  }, [isHelpOpen, syncHelpPosition])

  useEffect(() => {
    if (!isHelpOpen) {
      return
    }
    const scrollY = window.scrollY
    const htmlEl = document.documentElement

    const previousHtmlOverflow = htmlEl.style.overflow
    const previousHtmlOverscroll = htmlEl.style.overscrollBehavior
    const previousBodyOverflow = document.body.style.overflow
    const previousBodyPosition = document.body.style.position
    const previousBodyTop = document.body.style.top
    const previousBodyWidth = document.body.style.width
    const previousBodyOverscroll = document.body.style.overscrollBehavior

    htmlEl.style.overflow = 'hidden'
    htmlEl.style.overscrollBehavior = 'none'
    document.body.style.overflow = 'hidden'
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollY}px`
    document.body.style.width = '100%'
    document.body.style.overscrollBehavior = 'none'

    const handleTouchMove = (event) => {
      if (helpModalRef.current?.contains(event.target)) {
        return
      }
      event.preventDefault()
    }
    document.addEventListener('touchmove', handleTouchMove, { passive: false })

    return () => {
      document.removeEventListener('touchmove', handleTouchMove)
      htmlEl.style.overflow = previousHtmlOverflow
      htmlEl.style.overscrollBehavior = previousHtmlOverscroll
      document.body.style.overflow = previousBodyOverflow
      document.body.style.position = previousBodyPosition
      document.body.style.top = previousBodyTop
      document.body.style.width = previousBodyWidth
      document.body.style.overscrollBehavior = previousBodyOverscroll
      window.scrollTo({ top: scrollY, behavior: 'auto' })
    }
  }, [isHelpOpen])

  const handleOpenHelp = () => {
    setHelpStepIndex(0)
    setIsHelpOpen(true)
  }

  const handleCloseHelp = () => {
    setIsHelpOpen(false)
  }

  const handlePrevHelp = () => {
    setHelpStepIndex((prev) => Math.max(0, prev - 1))
  }

  const handleNextHelp = () => {
    setHelpStepIndex((prev) => Math.min(HELP_STEPS.length - 1, prev + 1))
  }

  return (
    <div className="space-y-5">
      <div className="relative">
        <div className="rounded-2xl bg-muted/70 px-2">
          <div className="grid grid-cols-3">
            {TAB_ITEMS.map((tab) => {
              const isQuizTab = tab.id === 'quiz'
              const isQuizEnabled =
                !isQuizTab || ['summary_card_passed', 'solved'].includes(problem?.status ?? '')
              const tabRef =
                tab.id === 'chatbot' ? chatbotTabRef : tab.id === 'quiz' ? quizTabRef : null

              return (
                <button
                  key={tab.id}
                  ref={tabRef}
                  className={`flex w-full flex-col items-center justify-center gap-1 px-3 py-3 text-xs font-semibold transition ${
                    tab.id === ACTIVE_TAB_ID ? 'text-info' : 'text-neutral-500'
                  } ${!isQuizEnabled ? 'cursor-not-allowed opacity-50' : ''}`}
                  disabled={!isQuizEnabled}
                  onClick={() => {
                    if (!problemId) {
                      return
                    }
                    if (tab.id === 'quiz') {
                      navigate(`/problems/${problemId}/quiz`)
                    }
                    if (tab.id === 'problem') {
                      navigate(`/problems/${problemId}`)
                    }
                    if (tab.id === 'chatbot') {
                      navigate(`/problems/${problemId}/chatbot`)
                    }
                  }}
                  type="button"
                >
                  <tab.Icon className="h-5 w-5" />
                  {tab.label}
                  <span
                    className={`mt-1 h-[2px] w-12 rounded-full ${
                      tab.id === ACTIVE_TAB_ID ? 'bg-info' : 'bg-transparent'
                    }`}
                  />
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {isLoading ? (
        <Card className="border-dashed border-muted-foreground/40 bg-muted/40 p-6 text-center">
          <StatusMessage>문제 상세 정보를 불러오는 중입니다.</StatusMessage>
        </Card>
      ) : loadError ? (
        <Card className="border-dashed border-muted-foreground/40 bg-muted/40 p-6 text-center">
          <StatusMessage tone="error">{loadError}</StatusMessage>
          <Button className="mt-4" onClick={handleRetry} type="button" variant="secondary">
            다시 시도
          </Button>
        </Card>
      ) : problem ? (
        <div className="space-y-5">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 text-xs font-semibold text-muted-foreground">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="rounded-full bg-muted px-3 py-1 text-foreground/80">
                  {formatDifficultyLabel(problem.difficulty)}
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
              <Button
                className="h-8 rounded border-foreground/20 px-3 text-xs font-semibold"
                onClick={handleOpenHelp}
                type="button"
                variant="outline"
              >
                도움말
              </Button>
            </div>
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-foreground">{problem.title}</h2>
              <button
                aria-label={problem.bookmarked ? '북마크 해제' : '북마크 추가'}
                className="ml-auto rounded-full transition hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isBookmarking}
                onClick={handleBookmarkToggle}
                type="button"
              >
                <Star
                  className={`h-6 w-6 ${
                    problem.bookmarked ? 'fill-warning text-warning' : 'text-foreground'
                  }`}
                />
              </button>
            </div>
            <div className="h-px bg-border" />
          </div>

          <Button
            className="w-full gap-2 rounded-xl py-6"
            disabled={!hasSummaryCards}
            onClick={() => {
              if (problemId) {
                navigate(`/problems/${problemId}/summary`)
              }
            }}
            ref={summaryButtonRef}
            type="button"
            variant="secondary"
          >
            {hasSummaryCards ? <Sparkles className="h-5 w-5" /> : null}
            {hasSummaryCards ? '문제 요약 카드 만들기' : '요약 카드가 없습니다'}
          </Button>

          <section className="space-y-3">
            {problem.content ? (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({ node: _node, ...props }) => (
                    <h2 className="mt-6 mb-2 text-lg font-bold text-foreground" {...props} />
                  ),
                  h2: ({ ...props }) => (
                    <h2 className="mt-6 mb-2 text-lg font-bold text-foreground" {...props} />
                  ),

                  h3: ({ ...props }) => (
                    <h3 className="mt-4 mb-2 text-base font-semibold text-foreground" {...props} />
                  ),
                  h4: ({ node: _node, ...props }) => (
                    <h4 className="mt-3 mb-1 text-sm font-semibold text-foreground" {...props} />
                  ),

                  p: ({ ...props }) => (
                    <p className="mb-3 text-[15px] leading-[1.7] text-foreground/90" {...props} />
                  ),

                  hr: () => (
                    <div>
                      <br />
                      <hr className="border-foreground/10" />
                      <br />
                    </div>
                  ),

                  ul: ({ ...props }) => (
                    <ul
                      className="mb-3 list-disc space-y-2 pl-5 text-[15px] text-foreground/90"
                      {...props}
                    />
                  ),
                  ol: ({ ...props }) => (
                    <ol
                      className="mb-3 list-decimal space-y-2 pl-5 text-[15px] text-foreground/90"
                      {...props}
                    />
                  ),

                  li: ({ ...props }) => <li className="leading-relaxed" {...props} />,

                  blockquote: ({ node: _node, ...props }) => (
                    <blockquote
                      className="rounded-xl bg-muted/40 px-4 py-3 text-[15px] leading-[1.6] text-foreground/90"
                      {...props}
                    />
                  ),

                  table: ({ node: _node, ...props }) => (
                    <div className="my-3 overflow-x-auto">
                      <table className="min-w-full text-[13px] leading-relaxed" {...props} />
                    </div>
                  ),
                  thead: ({ node: _node, ...props }) => (
                    <thead className="bg-muted/60" {...props} />
                  ),
                  tbody: ({ node: _node, ...props }) => <tbody {...props} />,
                  tr: ({ node: _node, ...props }) => (
                    <tr className="border-b border-border" {...props} />
                  ),
                  th: ({ node: _node, children, ...props }) => (
                    <th
                      className="px-3 py-2 text-left text-xs font-semibold text-foreground/80"
                      {...props}
                    >
                      {splitWithLineBreaks(children, 'th')}
                    </th>
                  ),
                  td: ({ node: _node, children, ...props }) => (
                    <td className="px-3 py-2 align-top text-xs text-foreground/90" {...props}>
                      {splitWithLineBreaks(children, 'td')}
                    </td>
                  ),

                  pre: ({ ...props }) => (
                    <pre
                      className="my-3 overflow-x-auto rounded-xl bg-muted px-4 py-3 text-sm leading-relaxed"
                      {...props}
                    />
                  ),

                  code: ({ node: _node, inline, className, children, ...props }) => {
                    if (inline) {
                      return (
                        <code
                          className="rounded bg-muted/60 px-1.5 py-0.5 text-[0.85em] text-foreground/90"
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
              <StatusMessage>문제 설명이 없습니다.</StatusMessage>
            )}
          </section>
          <p className="!mt-10 text-sm text-neutral-500">※ 본 문제는 AI로 생성한 콘텐츠입니다.</p>
        </div>
      ) : null}

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

      {isHelpOpen ? (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0"
            aria-hidden
            onClick={(event) => event.preventDefault()}
          />
          {spotlightRect ? (
            <div
              className="absolute border-2 border-white/80"
              style={{
                top: spotlightRect.top,
                left: spotlightRect.left,
                width: spotlightRect.width,
                height: spotlightRect.height,
                borderRadius: spotlightRect.radius,
                boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.6)',
              }}
            />
          ) : (
            <div className="absolute inset-0 bg-black/60" />
          )}

          <div
            ref={helpModalRef}
            role="dialog"
            aria-modal="true"
            className="absolute w-[min(90vw,320px)] rounded-2xl bg-background p-4 shadow-xl"
            style={{ top: helpModalStyle.top, left: helpModalStyle.left }}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              aria-label="도움말 닫기"
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-background text-muted-foreground transition hover:text-foreground"
              onClick={handleCloseHelp}
              type="button"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="space-y-3">
              <h3 className="text-base font-semibold text-foreground">{currentHelpStep?.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {currentHelpStep?.description}
              </p>
            </div>
            <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {helpStepIndex + 1}/{HELP_STEPS.length}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  className="h-8 rounded-lg px-3 text-xs"
                  disabled={helpStepIndex === 0}
                  onClick={handlePrevHelp}
                  type="button"
                  variant="secondary"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  이전
                </Button>
                <Button
                  className="h-8 rounded-lg px-3 text-xs"
                  onClick={
                    helpStepIndex === HELP_STEPS.length - 1 ? handleCloseHelp : handleNextHelp
                  }
                  type="button"
                >
                  {helpStepIndex === HELP_STEPS.length - 1 ? '완료' : '다음'}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
