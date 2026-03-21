import { ImagePlus, Loader2, X } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'

import StatusMessage from '@/components/StatusMessage'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { createCustomProblem } from '@/services/customProblems/customProblemsService'
import {
  CUSTOM_PROBLEM_ACCEPTED_TYPES,
  validateCustomProblemImageFile,
} from '@/services/customProblems/customProblemsUploadPolicy'

const MAX_IMAGES = 4
const EMPTY_SLOTS = Array.from({ length: MAX_IMAGES }, () => null)

const PROGRESS_MESSAGES = {
  upload: '이미지를 업로드하는 중입니다...',
  create: '문제 생성을 요청하는 중입니다...',
}

export default function CustomProblemCreateDialog({ open, onOpenChange, onCreated }) {
  const fileInputRefs = useRef([])
  const [slots, setSlots] = useState(EMPTY_SLOTS)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [progressStep, setProgressStep] = useState(null)
  const [error, setError] = useState(null)

  const reset = useCallback(() => {
    setSlots((prev) => {
      prev.forEach((slot) => {
        if (slot) {
          URL.revokeObjectURL(slot.preview)
        }
      })
      return EMPTY_SLOTS
    })
    setIsSubmitting(false)
    setProgressStep(null)
    setError(null)
  }, [])

  const handleOpenChange = useCallback(
    (value) => {
      if (!value && isSubmitting) {
        return
      }
      if (!value) {
        reset()
      }
      onOpenChange(value)
    },
    [isSubmitting, onOpenChange, reset],
  )

  const handleSlotClick = (index) => {
    if (isSubmitting) {
      return
    }
    fileInputRefs.current[index]?.click()
  }

  const handleFileChange = (index, event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    const validationError = validateCustomProblemImageFile(file)
    if (!file || validationError) {
      setError(validationError)
      return
    }

    setSlots((prev) => {
      const next = [...prev]
      if (next[index]) {
        URL.revokeObjectURL(next[index].preview)
      }
      next[index] = { file, preview: URL.createObjectURL(file) }
      return next
    })
    setError(null)
  }

  const selectedFiles = slots.filter(Boolean).map((slot) => slot.file)

  const handleSubmit = async () => {
    if (selectedFiles.length === 0 || isSubmitting) {
      return
    }

    setIsSubmitting(true)
    setError(null)
    setProgressStep(null)

    try {
      await createCustomProblem(selectedFiles, setProgressStep)
      reset()
      onOpenChange(false)
      onCreated?.()
    } catch (err) {
      const message = err?.response?.data?.message || '문제 생성에 실패했습니다. 다시 시도해주세요.'
      setError(message)
    } finally {
      setIsSubmitting(false)
      setProgressStep(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="gap-0 p-0" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader className="shrink-0 px-5 pt-5 pb-3">
          <div className="flex items-center justify-between">
            <DialogTitle>문제 만들기</DialogTitle>
            <DialogClose asChild>
              <button
                aria-label="닫기"
                className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
                disabled={isSubmitting}
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </DialogClose>
          </div>
        </DialogHeader>

        <div className="space-y-4 px-5 pb-5">
          <div className="flex gap-2">
            {slots.map((slot, index) => (
              <div key={index} className="relative flex-1">
                {slot ? (
                  <button
                    className="relative aspect-square w-full overflow-hidden rounded-lg border-2 border-foreground/20 transition hover:border-foreground/40"
                    disabled={isSubmitting}
                    onClick={() => handleSlotClick(index)}
                    type="button"
                  >
                    <img
                      alt={`이미지 ${index + 1}`}
                      className="h-full w-full object-cover"
                      src={slot.preview}
                    />
                  </button>
                ) : (
                  <button
                    className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-muted-foreground/30 text-muted-foreground transition hover:border-foreground/40 hover:text-foreground/60"
                    disabled={isSubmitting}
                    onClick={() => handleSlotClick(index)}
                    type="button"
                  >
                    <ImagePlus className="h-5 w-5" />
                    <span className="text-[10px] font-medium">{index + 1}</span>
                  </button>
                )}
                <input
                  ref={(el) => {
                    fileInputRefs.current[index] = el
                  }}
                  accept={CUSTOM_PROBLEM_ACCEPTED_TYPES.join(',')}
                  className="hidden"
                  onChange={(e) => handleFileChange(index, e)}
                  type="file"
                />
              </div>
            ))}
          </div>

          {error ? <StatusMessage tone="error">{error}</StatusMessage> : null}

          {isSubmitting && progressStep ? (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{PROGRESS_MESSAGES[progressStep]}</span>
            </div>
          ) : null}

          <Button
            className="w-full rounded-full"
            disabled={selectedFiles.length === 0 || isSubmitting}
            onClick={handleSubmit}
            type="button"
          >
            {isSubmitting ? '생성 중...' : '생성하기'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
