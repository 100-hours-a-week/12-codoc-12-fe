import { ImagePlus, Loader2, X } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import StatusMessage from '@/components/StatusMessage'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createCustomProblem } from '@/services/customProblems/customProblemsService'
import {
  CUSTOM_PROBLEM_ACCEPTED_TYPES,
  validateCustomProblemImageFile,
} from '@/services/customProblems/customProblemsUploadPolicy'

const MAX_IMAGES = 4

const PROGRESS_MESSAGES = {
  upload: '이미지를 업로드하는 중입니다...',
  create: '문제 생성을 요청하는 중입니다...',
}

export default function CustomProblemCreate() {
  const navigate = useNavigate()
  const fileInputRef = useRef(null)
  const [selectedFiles, setSelectedFiles] = useState([])
  const [previews, setPreviews] = useState([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [progressStep, setProgressStep] = useState(null)
  const [error, setError] = useState(null)

  const addFiles = useCallback(
    (files) => {
      const candidateFiles = Array.from(files)
      const firstValidationError =
        candidateFiles.map(validateCustomProblemImageFile).find(Boolean) ?? null
      const validFiles = candidateFiles.filter((file) => !validateCustomProblemImageFile(file))

      if (firstValidationError) {
        setError(firstValidationError)
      }

      if (validFiles.length === 0) {
        return
      }

      const remaining = MAX_IMAGES - selectedFiles.length
      const filesToAdd = validFiles.slice(0, remaining)
      if (filesToAdd.length === 0) {
        return
      }

      const newPreviews = filesToAdd.map((file) => URL.createObjectURL(file))

      setSelectedFiles((prev) => [...prev, ...filesToAdd])
      setPreviews((prev) => [...prev, ...newPreviews])
      if (!firstValidationError) {
        setError(null)
      }
    },
    [selectedFiles.length],
  )

  const removeFile = useCallback((index) => {
    setPreviews((prev) => {
      URL.revokeObjectURL(prev[index])
      return prev.filter((_, i) => i !== index)
    })
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const handleFileChange = (event) => {
    addFiles(event.target.files)
    event.target.value = ''
  }

  const handleSubmit = async () => {
    if (selectedFiles.length === 0 || isSubmitting) {
      return
    }

    setIsSubmitting(true)
    setError(null)
    setProgressStep(null)

    try {
      await createCustomProblem(selectedFiles, setProgressStep)
      navigate('/custom-problems', { replace: true })
    } catch (err) {
      const message = err?.response?.data?.message || '문제 생성에 실패했습니다. 다시 시도해주세요.'
      setError(message)
    } finally {
      setIsSubmitting(false)
      setProgressStep(null)
    }
  }

  return (
    <div className="space-y-5">
      <Card className="bg-muted/70">
        <CardHeader>
          <CardTitle>문제 만들기</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {previews.map((src, index) => (
              <div key={src} className="group relative aspect-[4/3] overflow-hidden rounded-lg">
                <img
                  alt={`선택 이미지 ${index + 1}`}
                  className="h-full w-full object-cover"
                  src={src}
                />
                {!isSubmitting ? (
                  <button
                    aria-label={`이미지 ${index + 1} 삭제`}
                    className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100"
                    onClick={() => removeFile(index)}
                    type="button"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
            ))}

            {selectedFiles.length < MAX_IMAGES ? (
              <button
                className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/30 text-muted-foreground transition hover:border-foreground/40 hover:text-foreground/60"
                disabled={isSubmitting}
                onClick={() => fileInputRef.current?.click()}
                type="button"
              >
                <ImagePlus className="h-6 w-6" />
                <span className="text-xs font-medium">
                  {selectedFiles.length}/{MAX_IMAGES}
                </span>
              </button>
            ) : null}
          </div>

          <input
            ref={fileInputRef}
            accept={CUSTOM_PROBLEM_ACCEPTED_TYPES.join(',')}
            className="hidden"
            multiple
            onChange={handleFileChange}
            type="file"
          />

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
        </CardContent>
      </Card>
    </div>
  )
}
