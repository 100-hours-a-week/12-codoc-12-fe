import { BookOpen, Brain, Clover } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import ProblemSummaryCards from '@/components/ProblemSummaryCards'
import { getProblemDetail } from '@/services/problems/problemsService'

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
          setLoadError('요약 카드 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.')
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
  }, [problemId])

  const summaryCards = useMemo(() => problem?.summaryCards ?? [], [problem])
  const problemStatus = problem?.status ?? null

  const handleQuizStart = () => {
    if (problemId) {
      navigate(`/problems/${problemId}/quiz`)
    }
  }

  const handleClose = () => {
    if (problemId) {
      navigate(`/problems/${problemId}`)
    }
  }

  const handleStatusChange = (status) => {
    setProblem((prev) => (prev ? { ...prev, status } : prev))
  }

  return (
    <div className="animate-in fade-in-0 slide-in-from-right-2 duration-300 space-y-5">
      <div className="rounded-2xl bg-muted/70 px-2">
        <div className="grid grid-cols-3">
          {TAB_ITEMS.map((tab) => {
            const isQuizTab = tab.id === 'quiz'
            const isQuizEnabled =
              !isQuizTab || ['summary_card_passed', 'solved'].includes(problemStatus ?? '')

            return (
              <button
                key={tab.id}
                className={`flex flex-col items-center justify-center gap-1 px-3 py-3 text-xs font-semibold transition ${
                  tab.id === ACTIVE_TAB_ID ? 'text-info' : 'text-neutral-500'
                } ${!isQuizEnabled ? 'cursor-not-allowed opacity-50' : ''}`}
                disabled={!isQuizEnabled}
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
      ) : (
        <ProblemSummaryCards
          problemId={problem?.id ?? problemId}
          summaryCards={summaryCards}
          onClose={handleClose}
          onQuizStart={handleQuizStart}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
  )
}
