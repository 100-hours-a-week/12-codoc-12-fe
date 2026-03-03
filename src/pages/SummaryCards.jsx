import { BookOpen, Brain, Clover } from 'lucide-react'
import { motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import SessionTimer from '@/components/SessionTimer'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import ProblemSummaryCards from '@/components/ProblemSummaryCards'
import { isSessionExpired, isSessionRequiredError } from '@/lib/session'
import { queueProblemListUpdate } from '@/lib/problemListUpdates'
import { trackEvent } from '@/lib/ga4'
import { getProblemDetail, startProblemSession } from '@/services/problems/problemsService'
import { useProblemDetailStore } from '@/stores/useProblemDetailStore'
import { useProblemSessionStore } from '@/stores/useProblemSessionStore'

const TAB_ITEMS = [
  { id: 'problem', label: '문제', Icon: BookOpen },
  { id: 'chatbot', label: 'AI 챗봇', Icon: Brain },
  { id: 'quiz', label: '퀴즈', Icon: Clover },
]

const ACTIVE_TAB_ID = 'problem'

export default function SummaryCards() {
  const { problemId } = useParams()
  const navigate = useNavigate()
  const [problem, setProblem] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [isExiting, setIsExiting] = useState(false)
  const [isSessionStarting, setIsSessionStarting] = useState(false)
  const [sessionError, setSessionError] = useState(null)
  const [isSessionRequired, setIsSessionRequired] = useState(false)
  const hasTrackedSummaryCompleteRef = useRef(false)
  const { sessions, setSession } = useProblemSessionStore()
  const { fetchProblem: fetchProblemDetail, setProblem: setCachedProblem } = useProblemDetailStore()
  const session = problemId ? sessions[String(problemId)] : null
  const isExpired = isSessionExpired(session?.expiresAt)
  const hasActiveSession = Boolean(session?.sessionId) && !isExpired
  const activeSession = useMemo(() => {
    const items = Object.values(sessions)
    return items.find((entry) => entry?.sessionId) ?? null
  }, [sessions])
  const isActiveSessionExpired = isSessionExpired(activeSession?.expiresAt)
  const hasOtherActiveSession =
    Boolean(activeSession?.sessionId) &&
    !isActiveSessionExpired &&
    String(activeSession?.problemId ?? '') !== String(problemId ?? '')

  useEffect(() => {
    if (!problemId) {
      return
    }
    trackEvent('summary_view', { problem_id: String(problemId) })
    hasTrackedSummaryCompleteRef.current = false
  }, [problemId])

  useEffect(() => {
    let isActive = true

    const loadProblem = async () => {
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
        const data = await fetchProblemDetail(problemId, getProblemDetail)
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
          setLoadError('요약 카드 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.')
          setProblem(null)
        }
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    loadProblem()

    return () => {
      isActive = false
    }
  }, [fetchProblemDetail, navigate, problemId])

  const summaryCards = useMemo(() => session?.summaryCards ?? [], [session])
  const problemStatus = problem?.status ?? null

  const handleQuizStart = () => {
    if (problemId) {
      navigate(`/problems/${problemId}/quiz`)
    }
  }

  const handleClose = () => {
    if (isExiting) {
      return
    }
    setIsExiting(true)
  }

  const handleStartSession = async () => {
    if (!problemId || isSessionStarting) {
      return
    }
    setIsSessionStarting(true)
    setSessionError(null)
    try {
      const response = await startProblemSession(problemId)
      setSession(problemId, response)
      setIsSessionRequired(false)
    } catch (error) {
      if (isSessionRequiredError(error)) {
        setIsSessionRequired(true)
        return
      }
      setSessionError('세션을 시작하지 못했습니다. 잠시 후 다시 시도해주세요.')
    } finally {
      setIsSessionStarting(false)
    }
  }

  const handleStatusChange = (status) => {
    setProblem((prev) => (prev ? { ...prev, status } : prev))
    if (
      problemId &&
      !hasTrackedSummaryCompleteRef.current &&
      (status === 'summary_card_passed' || status === 'solved')
    ) {
      trackEvent('summary_complete', { problem_id: String(problemId) })
      hasTrackedSummaryCompleteRef.current = true
    }
    if (problem?.id) {
      queueProblemListUpdate({
        id: problem.id,
        status,
        bookmarked: problem.bookmarked,
        difficulty: problem.difficulty,
        title: problem.title,
      })
      setCachedProblem(problem.id, { ...problem, status })
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-muted/70 px-2">
        <div className="grid grid-cols-3">
          {TAB_ITEMS.map((tab) => {
            const isQuizTab = tab.id === 'quiz'
            const isQuizEnabled =
              !isQuizTab || ['summary_card_passed', 'solved'].includes(problemStatus ?? '')
            const isSessionEnabled = tab.id === 'problem' || hasActiveSession
            const isEnabled = isSessionEnabled && (!isQuizTab || isQuizEnabled)

            return (
              <button
                key={tab.id}
                className={`flex flex-col items-center justify-center gap-1 px-3 py-3 text-xs font-semibold transition ${
                  tab.id === ACTIVE_TAB_ID
                    ? 'text-info'
                    : isEnabled
                      ? 'text-foreground/80'
                      : 'text-neutral-500'
                } ${!isEnabled ? 'cursor-not-allowed opacity-50' : ''}`}
                disabled={!isEnabled}
                onClick={() => {
                  if (!problemId) {
                    return
                  }
                  if (tab.id === 'problem') {
                    navigate(`/problems/${problemId}`)
                  }
                  if (tab.id === 'chatbot') {
                    navigate(`/problems/${problemId}/chatbot`)
                  }
                  if (tab.id === 'quiz') {
                    navigate(`/problems/${problemId}/quiz`)
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

      {hasActiveSession ? (
        <div className="flex justify-end">
          <SessionTimer expiresAt={session?.expiresAt} />
        </div>
      ) : null}

      <motion.div
        style={{
          transformStyle: 'preserve-3d',
          transformPerspective: 1200,
          backfaceVisibility: 'hidden',
        }}
        initial="enter"
        animate={isExiting ? 'exit' : 'center'}
        variants={{
          enter: {
            opacity: 0,
            rotateY: -180,
            x: 12,
            y: 6,
            scale: 0.96,
          },
          center: {
            opacity: 1,
            rotateY: 0,
            x: 0,
            y: 0,
            scale: 1,
            transition: { type: 'spring', stiffness: 240, damping: 28, mass: 0.9 },
          },
          exit: {
            opacity: 0,
            rotateY: 180,
            x: -12,
            y: 4,
            scale: 0.96,
            transition: { duration: 0.3, ease: 'easeInOut' },
          },
        }}
        onAnimationComplete={() => {
          if (!isExiting) {
            return
          }
          if (problemId) {
            navigate(`/problems/${problemId}`)
          } else {
            navigate('/problems')
          }
        }}
      >
        {isLoading ? (
          <Card className="border-dashed border-muted-foreground/40 bg-muted/40 p-6 text-center">
            <p className="text-sm text-muted-foreground">요약 카드를 불러오는 중입니다.</p>
          </Card>
        ) : loadError ? (
          <Card className="border-dashed border-muted-foreground/40 bg-muted/40 p-6 text-center">
            <p className="text-sm text-danger">{loadError}</p>
            <Button className="mt-4" onClick={() => window.location.reload()} variant="secondary">
              다시 시도
            </Button>
          </Card>
        ) : isSessionRequired || !hasActiveSession ? (
          <Card className="border-dashed border-muted-foreground/40 bg-muted/40 p-6 text-center">
            <p className="text-sm text-muted-foreground">
              {isExpired || isSessionRequired
                ? '세션이 만료되었습니다. 다시 시작해주세요.'
                : '문제 풀이를 시작해야 요약 카드를 풀 수 있어요.'}
            </p>
            {sessionError ? <p className="mt-2 text-xs text-danger">{sessionError}</p> : null}
            <Button
              className="mt-4 w-full rounded-xl bg-[hsl(0_91%_60%)] text-white hover:bg-[hsl(0_91%_60%)]/90"
              disabled={isSessionStarting || hasOtherActiveSession}
              onClick={handleStartSession}
              type="button"
            >
              문제 풀이 시작
            </Button>
          </Card>
        ) : (
          <ProblemSummaryCards
            problemId={problem?.id ?? problemId}
            summaryCards={summaryCards}
            onClose={handleClose}
            onQuizStart={handleQuizStart}
            onStatusChange={handleStatusChange}
            onSessionRequired={() => setIsSessionRequired(true)}
          />
        )}
      </motion.div>
    </div>
  )
}
