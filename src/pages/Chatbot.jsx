import { BookOpen, Brain, Clover, Send } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { getProblemDetail } from '@/services/problems/problemsService'
import { createChatbotStream, sendChatbotMessage } from '@/services/chatbot/chatbotService'

const TAB_ITEMS = [
  { id: 'problem', label: '문제', Icon: BookOpen },
  { id: 'chatbot', label: 'AI 챗봇', Icon: Brain },
  { id: 'quiz', label: '퀴즈', Icon: Clover },
]

const ACTIVE_TAB_ID = 'chatbot'

const INITIAL_MESSAGE = {
  id: 'assistant-intro',
  role: 'assistant',
  content:
    '안녕하세요! 코독이에요.\n지금부터 문제를 4단계로 쪼개 요약카드를 완성해봅시다.\n1단계는 “문제 배경(상황)”입니다.\n지금 어떤 상황인지 말해주세요.\n(누가/무엇을/얼마나를 잡아내면 좋습니다)',
}

const buildMessageId = () => `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

export default function Chatbot() {
  const { problemId } = useParams()
  const navigate = useNavigate()
  const [problemStatus, setProblemStatus] = useState(null)
  const [messages, setMessages] = useState([INITIAL_MESSAGE])
  const [inputValue, setInputValue] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [sendError, setSendError] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  const streamRef = useRef(null)
  const assistantMessageIdRef = useRef(null)
  const bottomRef = useRef(null)

  useEffect(() => {
    let isActive = true

    const fetchStatus = async () => {
      if (!problemId) {
        if (isActive) {
          setLoadError('문제 정보를 찾을 수 없습니다.')
          setProblemStatus(null)
          setIsLoading(false)
        }
        return
      }

      setIsLoading(true)
      setLoadError(null)

      try {
        const data = await getProblemDetail(problemId)
        if (isActive) {
          setProblemStatus(data.status)
        }
      } catch {
        if (isActive) {
          setLoadError('챗봇 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.')
          setProblemStatus(null)
        }
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    fetchStatus()

    return () => {
      isActive = false
    }
  }, [problemId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isStreaming])

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.close()
        streamRef.current = null
      }
    }
  }, [])

  const handleAppendAssistant = (text) => {
    const targetId = assistantMessageIdRef.current
    if (!targetId) {
      return
    }

    setMessages((prev) =>
      prev.map((message) =>
        message.id === targetId
          ? { ...message, content: `${message.content ?? ''}${text}` }
          : message,
      ),
    )
  }

  const handleReplaceAssistant = (text) => {
    const targetId = assistantMessageIdRef.current
    if (!targetId) {
      return
    }

    setMessages((prev) =>
      prev.map((message) =>
        message.id === targetId ? { ...message, content: text ?? '' } : message,
      ),
    )
  }

  const handleCloseStream = () => {
    if (streamRef.current) {
      streamRef.current.close()
      streamRef.current = null
    }
  }

  const handleSend = async () => {
    const trimmed = inputValue.trim()
    if (!trimmed || !problemId || isStreaming) {
      return
    }

    setSendError(null)
    setInputValue('')

    const userMessage = {
      id: buildMessageId(),
      role: 'user',
      content: trimmed,
    }
    const assistantId = buildMessageId()
    assistantMessageIdRef.current = assistantId

    setMessages((prev) => [
      ...prev,
      userMessage,
      { id: assistantId, role: 'assistant', content: '' },
    ])

    setIsStreaming(true)

    try {
      const response = await sendChatbotMessage({
        problemId,
        message: trimmed,
      })

      if (response.status === 'COMPLETED') {
        setIsStreaming(false)
        return
      }

      if (['ACCEPTED', 'PROCESSING'].includes(response.status) && response.conversationId) {
        handleCloseStream()
        streamRef.current = createChatbotStream(response.conversationId, {
          onMessage: (chunk) => {
            if (chunk) {
              handleAppendAssistant(chunk)
            }
          },
          onFinal: (eventData) => {
            const finalMessage = eventData?.result?.aiMessage
            if (finalMessage) {
              handleReplaceAssistant(finalMessage)
            }
          },
          onStatus: (status) => {
            if (status === 'COMPLETED') {
              setIsStreaming(false)
              handleCloseStream()
            }
          },
          onError: () => {
            setSendError('챗봇 응답을 받지 못했습니다. 다시 시도해주세요.')
            setIsStreaming(false)
            handleCloseStream()
          },
        })
        return
      }

      if (response.status === 'FAILED') {
        setIsStreaming(false)
        setSendError('챗봇 응답을 받지 못했습니다. 다시 시도해주세요.')
      }
    } catch {
      setSendError('메시지를 전송하지 못했습니다. 잠시 후 다시 시도해주세요.')
      setIsStreaming(false)
    }
  }

  const isQuizEnabled = useMemo(
    () => ['summary_card_passed', 'solved'].includes(problemStatus ?? ''),
    [problemStatus],
  )

  return (
    <div className="flex min-h-full flex-col space-y-5">
      <div className="rounded-2xl bg-muted/70 px-2">
        <div className="grid grid-cols-3">
          {TAB_ITEMS.map((tab) => {
            const isQuizTab = tab.id === 'quiz'
            const isEnabled = !isQuizTab || isQuizEnabled

            return (
              <button
                key={tab.id}
                className={`flex flex-col items-center justify-center gap-1 px-3 py-3 text-xs font-semibold transition ${
                  tab.id === ACTIVE_TAB_ID ? 'text-foreground' : 'text-muted-foreground'
                } ${!isEnabled ? 'cursor-not-allowed opacity-50' : ''}`}
                disabled={!isEnabled}
                onClick={() => {
                  if (!problemId) {
                    return
                  }
                  if (tab.id === 'problem') {
                    navigate(`/problems/${problemId}`)
                  }
                  if (tab.id === 'quiz' && isEnabled) {
                    navigate(`/problems/${problemId}/quiz`)
                  }
                }}
                type="button"
              >
                <tab.Icon className="h-5 w-5" />
                {tab.label}
                <span
                  className={`mt-1 h-[2px] w-12 rounded-full ${
                    tab.id === ACTIVE_TAB_ID ? 'bg-foreground' : 'bg-transparent'
                  }`}
                />
              </button>
            )
          })}
        </div>
      </div>

      {isLoading ? (
        <Card className="border-dashed border-muted-foreground/40 bg-muted/40 p-6 text-center">
          <p className="text-sm text-muted-foreground">챗봇을 준비하는 중입니다.</p>
        </Card>
      ) : loadError ? (
        <Card className="border-dashed border-muted-foreground/40 bg-muted/40 p-6 text-center">
          <p className="text-sm text-red-500">{loadError}</p>
          <Button className="mt-4" onClick={() => window.location.reload()} variant="secondary">
            다시 시도
          </Button>
        </Card>
      ) : (
        <div className="flex flex-1 flex-col gap-4">
          <div className="flex-1 space-y-3 pb-16">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`flex max-w-[78%] gap-2 ${
                    message.role === 'user' ? 'flex-row-reverse' : 'items-start'
                  }`}
                >
                  {message.role === 'assistant' ? (
                    <div className="mt-1 h-8 w-8 shrink-0 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground">
                      코독
                    </div>
                  ) : null}
                  <div
                    className={`rounded-2xl border px-4 py-3 text-sm leading-relaxed ${
                      message.role === 'user'
                        ? 'border-muted-foreground/20 bg-background text-foreground'
                        : 'border-muted-foreground/20 bg-muted/40 text-foreground'
                    }`}
                  >
                    <p className="whitespace-pre-line">{message.content}</p>
                  </div>
                </div>
              </div>
            ))}
            {isStreaming ? (
              <div className="flex justify-start">
                <div className="flex max-w-[78%] items-center gap-2">
                  <div className="mt-1 h-8 w-8 shrink-0 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground">
                    코독
                  </div>
                  <div className="rounded-2xl border border-muted-foreground/20 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                    ...
                  </div>
                </div>
              </div>
            ) : null}
            <div ref={bottomRef} />
          </div>

          {sendError ? <p className="text-xs text-red-500">{sendError}</p> : null}

          <div className="sticky bottom-0 -mx-4 bg-background/95 px-4 pb-2 pt-2 backdrop-blur sm:-mx-6 sm:px-6">
            <div className="flex items-end gap-2 rounded-2xl border border-muted-foreground/20 bg-background p-2 shadow-sm">
              <Input
                className="h-10 flex-1 border-none px-2 text-sm focus-visible:ring-0"
                disabled={isStreaming}
                onChange={(event) => setInputValue(event.target.value)}
                placeholder="메시지를 입력하세요"
                value={inputValue}
              />
              <Button
                className="h-10 rounded-xl"
                disabled={isStreaming || inputValue.trim().length === 0}
                onClick={handleSend}
                size="sm"
                type="button"
                variant="secondary"
              >
                <Send className="h-4 w-4" />
                전송
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
