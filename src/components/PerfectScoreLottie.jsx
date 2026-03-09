import Lottie from 'lottie-react'
import { useEffect, useState } from 'react'

const PERFECT_SCORE_LOTTIE_PATH = '/lottie/perfect-score-confetti.json'
let cachedAnimationData = null

export default function PerfectScoreLottie({
  containerClassName = 'mx-auto w-full max-w-[240px]',
}) {
  const [animationData, setAnimationData] = useState(cachedAnimationData)

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

  if (!animationData) {
    return null
  }

  return (
    <div aria-hidden className={`pointer-events-none ${containerClassName}`}>
      <Lottie animationData={animationData} autoplay loop />
    </div>
  )
}
