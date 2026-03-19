import { CheckCircle, ChevronLeft, ChevronRight, X, XCircle } from 'lucide-react'
import { useCallback, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const GUIDE_SLIDES = [
  {
    tone: 'good',
    image: '/guide/custom-good-1.png',
    title: '하나의 문제를 올려주세요',
    caption: '하나의 문제가 담긴 이미지',
    tips: [
      '하나의 문제만 담긴 이미지',
      '내용이 잘리지 않고 전체가 보이는 이미지',
      '텍스트가 잘 읽히는 이미지',
    ],
  },
  {
    tone: 'good',
    image: '/guide/custom-good-2.png',
    title: '긴 문제는 나눠서 올려주세요',
    caption: '이어지는 내용을 순서대로 업로드',
    tips: [
      '한 화면에 안 담기면 나눠서 업로드',
      '순서대로 올려주세요 (최대 4장)',
      '같은 문제의 내용끼리 묶어서 업로드',
    ],
  },
  {
    tone: 'bad',
    image: '/guide/custom-bad-3.png',
    title: '내용이 잘리면 안 돼요',
    caption: '내용이 잘린 이미지',
    tips: ['내용이 잘리거나 일부만 보이는 이미지', '글자가 흐릿하거나 읽기 어려운 이미지'],
  },
  {
    tone: 'bad',
    image: '/guide/custom-bad-4.png',
    title: '여러 문제를 섞지 마세요',
    caption: '여러 문제가 섞인 이미지',
    tips: ['서로 다른 문제가 섞인 이미지', '관련 없는 내용이 포함된 이미지'],
  },
]

export default function CustomProblemGuideDialog({ open, onOpenChange }) {
  const [currentSlide, setCurrentSlide] = useState(0)

  const slide = GUIDE_SLIDES[currentSlide]
  const isFirst = currentSlide === 0
  const isLast = currentSlide === GUIDE_SLIDES.length - 1
  const isGood = slide.tone === 'good'

  const handlePrev = useCallback(() => {
    setCurrentSlide((prev) => Math.max(0, prev - 1))
  }, [])

  const handleNext = useCallback(() => {
    setCurrentSlide((prev) => Math.min(GUIDE_SLIDES.length - 1, prev + 1))
  }, [])

  const handleOpenChange = useCallback(
    (value) => {
      if (!value) {
        setCurrentSlide(0)
      }
      onOpenChange(value)
    },
    [onOpenChange],
  )

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="flex h-[520px] flex-col gap-0 p-0"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="shrink-0 px-5 pt-5 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isGood ? (
                <CheckCircle className="h-4 w-4 text-success" />
              ) : (
                <XCircle className="h-4 w-4 text-[hsl(var(--danger))]" />
              )}
              <DialogTitle>{slide.title}</DialogTitle>
            </div>
            <DialogClose asChild>
              <button
                aria-label="닫기"
                className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </DialogClose>
          </div>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col px-5">
          <div
            className="flex items-center justify-center overflow-hidden rounded-xl border border-muted-foreground/20 bg-muted/30"
            style={{ height: '280px' }}
          >
            <img alt={slide.caption} className="h-full w-full object-contain" src={slide.image} />
          </div>

          <div className="mt-3 space-y-1.5">
            {slide.tips.map((tip) => (
              <div key={tip} className="flex items-start gap-2 text-xs">
                {isGood ? (
                  <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                ) : (
                  <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[hsl(var(--danger))]" />
                )}
                <span className="text-foreground/80">{tip}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-between px-5 pt-4 pb-5">
          <Button
            className="h-8 w-8 rounded-full p-0"
            disabled={isFirst}
            onClick={handlePrev}
            size="icon"
            type="button"
            variant="ghost"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="flex gap-1.5">
            {GUIDE_SLIDES.map((_, index) => (
              <button
                key={index}
                aria-label={`슬라이드 ${index + 1}`}
                className={`h-1.5 rounded-full transition-all ${
                  index === currentSlide ? 'w-4 bg-foreground' : 'w-1.5 bg-muted-foreground/30'
                }`}
                onClick={() => setCurrentSlide(index)}
                type="button"
              />
            ))}
          </div>

          {isLast ? (
            <DialogClose asChild>
              <Button className="h-8 rounded-full px-4 text-xs" type="button" variant="outline">
                확인
              </Button>
            </DialogClose>
          ) : (
            <Button
              className="h-8 w-8 rounded-full p-0"
              onClick={handleNext}
              size="icon"
              type="button"
              variant="ghost"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
