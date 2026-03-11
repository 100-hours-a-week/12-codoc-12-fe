import Lottie from 'lottie-react'
import { useEffect, useRef, useState } from 'react'

const PERFECT_SCORE_LOTTIE_PATH = '/lottie/perfect-score-confetti.json'
let cachedAnimationData = null

export default function PerfectScoreLottie({
  containerClassName = 'mx-auto w-full max-w-[240px]',
  speed = 1,
  loopDelayMs = 0,
}) {
  const [animationData, setAnimationData] = useState(cachedAnimationData)
  const lottieRef = useRef(null)
  const loopTimeoutRef = useRef(null)

  useEffect(() => {
    let isActive = true

    if (cachedAnimationData) {
      return () => {
        isActive = false
      }
    }

    const loadAnimation = async () => {
      try {
        const response = await fetch(PERFECT_SCORE_LOTTIE_PATH)
        if (!response.ok) {
          return
        }
        const data = await response.json()
        cachedAnimationData = data
        if (isActive) {
          setAnimationData(data)
        }
      } catch {
        // Ignore animation load failures to avoid blocking the result screen.
      }
    }

    loadAnimation()

    return () => {
      isActive = false
    }
  }, [])

  useEffect(() => {
    const normalizedSpeed = Number.isFinite(speed) && speed > 0 ? speed : 1
    lottieRef.current?.setSpeed?.(normalizedSpeed)
  }, [speed, animationData])

  useEffect(
    () => () => {
      if (loopTimeoutRef.current) {
        clearTimeout(loopTimeoutRef.current)
      }
    },
    [],
  )

  if (!animationData) {
    return null
  }

  const normalizedLoopDelayMs = Number.isFinite(loopDelayMs) && loopDelayMs > 0 ? loopDelayMs : 0

  const handleComplete = () => {
    if (normalizedLoopDelayMs <= 0) {
      return
    }

    if (loopTimeoutRef.current) {
      clearTimeout(loopTimeoutRef.current)
    }

    loopTimeoutRef.current = setTimeout(() => {
      lottieRef.current?.goToAndPlay?.(0, true)
    }, normalizedLoopDelayMs)
  }

  return (
    <div aria-hidden className={`pointer-events-none ${containerClassName}`}>
      <Lottie
        animationData={animationData}
        autoplay
        loop={normalizedLoopDelayMs <= 0}
        lottieRef={lottieRef}
        onComplete={normalizedLoopDelayMs > 0 ? handleComplete : undefined}
      />
    </div>
  )
}
