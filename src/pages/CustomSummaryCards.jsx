import { motion } from 'framer-motion'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import CustomProblemSummaryCards from '@/components/customProblems/CustomProblemSummaryCards'
import CustomProblemTabs from '@/components/customProblems/CustomProblemTabs'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { getCustomProblemDetail } from '@/services/customProblems/customProblemsService'
import { useCustomProblemDetailStore } from '@/stores/useCustomProblemDetailStore'

const ACTIVE_TAB_ID = 'problem'

export default function CustomSummaryCards() {
  const { customProblemId } = useParams()
  const navigate = useNavigate()
  const [problem, setProblem] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [isExiting, setIsExiting] = useState(false)
  const { fetchProblem: fetchCustomProblemDetail } = useCustomProblemDetailStore()

  const fetchDetail = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)
    try {
      const result = await fetchCustomProblemDetail(customProblemId, getCustomProblemDetail)
      setProblem(result)
    } catch {
      setLoadError('요약 카드 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.')
      setProblem(null)
    } finally {
      setIsLoading(false)
    }
  }, [customProblemId, fetchCustomProblemDetail])

  useEffect(() => {
    fetchDetail()
  }, [fetchDetail])

  return (
    <div className="space-y-5">
      <CustomProblemTabs activeTab={ACTIVE_TAB_ID} customProblemId={customProblemId} />

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
          if (customProblemId) {
            navigate(`/custom-problems/${customProblemId}`)
            return
          }
          navigate('/custom-problems')
        }}
      >
        {isLoading ? (
          <Card className="border-dashed border-muted-foreground/40 bg-muted/40 p-6 text-center">
            <p className="text-sm text-muted-foreground">요약 카드를 불러오는 중입니다.</p>
          </Card>
        ) : loadError ? (
          <Card className="border-dashed border-muted-foreground/40 bg-muted/40 p-6 text-center">
            <p className="text-sm text-danger">{loadError}</p>
            <Button className="mt-4" onClick={fetchDetail} type="button" variant="secondary">
              다시 시도
            </Button>
          </Card>
        ) : (
          <CustomProblemSummaryCards
            customProblemId={customProblemId}
            onClose={() => setIsExiting(true)}
            summaryCards={problem?.summaryCards ?? []}
          />
        )}
      </motion.div>
    </div>
  )
}
