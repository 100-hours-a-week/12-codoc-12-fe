import { ArrowDown, BookOpen, Brain, Clover, Send } from 'lucide-react'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { getProblemDetail } from '@/services/problems/problemsService'
import { createChatbotStream, sendChatbotMessage } from '@/services/chatbot/chatbotService'
import { useChatbotStore } from '@/stores/useChatbotStore'

const TAB_ITEMS = [
  { id: 'problem', label: '문제', Icon: BookOpen },
  { id: 'chatbot', label: 'AI 챗봇', Icon: Brain },
  { id: 'quiz', label: '퀴즈', Icon: Clover },
]

const ACTIVE_TAB_ID = 'chatbot'

const MAX_INPUT_LENGTH = 500
const STREAM_FAILED_MESSAGE = '요청에 실패했습니다. 다시 시도해주세요.'

const INITIAL_MESSAGE = {
  id: 'assistant-intro',
  role: 'assistant',
  content:
    '안녕하세요! 코독이에요.\n지금부터 문제를 4단계로 쪼개 요약카드를 완성해봅시다.\n1단계는 “문제 배경(상황)”입니다.\n지금 어떤 상황인지 말해주세요.\n(누가/무엇을/얼마나를 잡아내면 좋습니다)',
}

const buildMessageId = () => `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

const ChatMessage = memo(function ChatMessage({
  message,
  isPending,
  onSummaryClick,
  setStreamingTextNode,
  setTypingNode,
}) {
  const isUser = message.role === 'user'
  return (
    <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}>
      {isUser ? (
        <div className="max-w-[78%] space-y-2">
          <div className="rounded-2xl bg-info-soft px-4 py-3 text-[16px] leading-[28px] text-foreground">
            <p className="whitespace-pre-line">{message.content}</p>
          </div>
        </div>
      ) : (
        <div className="w-full space-y-2">
          <div className="text-[16px] leading-[28px] text-foreground">
            {isPending ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="whitespace-pre-line" ref={setStreamingTextNode} />
                <div
                  className="chatbot-typing"
                  ref={setTypingNode}
                  role="status"
                  aria-live="polite"
                >
                  <span className="sr-only">응답 생성 중</span>
                  <span aria-hidden="true" />
                  <span aria-hidden="true" />
                  <span aria-hidden="true" />
                </div>
              </div>
            ) : (
              <p className="whitespace-pre-line">{message.content}</p>
            )}
          </div>
          {message.role === 'assistant' && message.meta?.showSummaryCta ? (
            <Button
              className="w-fit rounded-xl bg-muted text-foreground hover:bg-muted/80"
              onClick={onSummaryClick}
              type="button"
              variant="secondary"
            >
              문제 요약 카드 풀러 가기
            </Button>
          ) : null}
        </div>
      )}
    </div>
  )
})

export default function Chatbot() {
  const { problemId } = useParams()
  const navigate = useNavigate()
  const [problemStatus, setProblemStatus] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const [keyboardOffset, setKeyboardOffset] = useState(0)

  const { sessions, initSession, updateSession } = useChatbotStore()
  const session = problemId ? sessions[String(problemId)] : null
  const messages = useMemo(() => session?.messages ?? [INITIAL_MESSAGE], [session?.messages])
  const inputValue = session?.inputValue ?? ''
  const conversationId = session?.conversationId ?? null
  const assistantMessageId = session?.assistantMessageId ?? null
  const isStreaming = session?.isStreaming ?? false
  const sendError = session?.sendError ?? null

  const streamRef = useRef(null)
  const assistantMessageIdRef = useRef(null)
  const streamingTextRef = useRef(null)
  const typingIndicatorRef = useRef(null)
  const didReceiveFinalRef = useRef(false)
  const tokenBufferRef = useRef('')
  const flushRafRef = useRef(null)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  const handleCloseStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.close()
      streamRef.current = null
    }
  }, [])

  const clearTokenBuffer = useCallback(() => {
    tokenBufferRef.current = ''
    if (flushRafRef.current) {
      cancelAnimationFrame(flushRafRef.current)
      flushRafRef.current = null
    }
  }, [])

  const clearStreamingNodes = useCallback(() => {
    streamingTextRef.current = null
    typingIndicatorRef.current = null
  }, [])

  const appendToAssistant = useCallback((text) => {
    if (!text) {
      return
    }
    if (!assistantMessageIdRef.current) {
      return
    }
    const node = streamingTextRef.current
    if (!node) {
      return
    }
    node.insertAdjacentText('beforeend', text)
    if (typingIndicatorRef.current) {
      typingIndicatorRef.current.style.display = 'none'
    }
  }, [])

  const flushTokenBuffer = useCallback(() => {
    const chunk = tokenBufferRef.current
    if (!chunk) {
      return
    }
    if (!streamingTextRef.current) {
      return
    }
    tokenBufferRef.current = ''
    appendToAssistant(chunk)
  }, [appendToAssistant])

  const setStreamingTextNode = useCallback(
    (node) => {
      streamingTextRef.current = node
      if (node) {
        node.textContent = ''
        flushTokenBuffer()
      }
    },
    [flushTokenBuffer],
  )

  const setTypingNode = useCallback((node) => {
    typingIndicatorRef.current = node
    if (node) {
      node.style.display = ''
    }
  }, [])

  const scheduleFlush = useCallback(() => {
    if (flushRafRef.current) {
      return
    }
    flushRafRef.current = requestAnimationFrame(() => {
      flushRafRef.current = null
      flushTokenBuffer()
    })
  }, [flushTokenBuffer])

  const handleAppendAssistant = useCallback(
    (text) => {
      if (!text) {
        return
      }
      tokenBufferRef.current = `${tokenBufferRef.current}${text}`
      scheduleFlush()
    },
    [scheduleFlush],
  )

  const checkIsAtBottom = useCallback(() => {
    const threshold = 160
    const scrollBottom = window.innerHeight + window.scrollY
    const pageHeight = document.documentElement.scrollHeight
    setIsAtBottom(scrollBottom >= pageHeight - threshold)
  }, [])

  const handleReplaceAssistant = useCallback(
    (text) => {
      const targetId = assistantMessageIdRef.current
      if (!targetId) {
        return
      }

      clearTokenBuffer()
      clearStreamingNodes()
      const currentMessages = useChatbotStore.getState().sessions[String(problemId)]?.messages ?? []

      updateSession(problemId, {
        messages: currentMessages.map((message) =>
          message.id === targetId ? { ...message, content: text ?? '' } : message,
        ),
      })
    },
    [clearTokenBuffer, clearStreamingNodes, problemId, updateSession],
  )

  const handleMarkSummaryReady = useCallback(
    (targetId) => {
      if (!problemId || !targetId) {
        return
      }
      const currentMessages = useChatbotStore.getState().sessions[String(problemId)]?.messages ?? []
      updateSession(problemId, {
        messages: currentMessages.map((message) =>
          message.id === targetId
            ? {
                ...message,
                meta: {
                  ...(message.meta ?? {}),
                  showSummaryCta: true,
                },
              }
            : message,
        ),
      })
    },
    [problemId, updateSession],
  )

  const handleStopStreaming = useCallback(
    ({ failureMessage, patch = {} } = {}) => {
      if (!problemId) {
        return
      }

      if (!failureMessage) {
        flushTokenBuffer()
      }
      clearTokenBuffer()
      clearStreamingNodes()
      didReceiveFinalRef.current = false
      handleCloseStream()
      const targetId = assistantMessageIdRef.current
      const currentMessages = useChatbotStore.getState().sessions[String(problemId)]?.messages ?? []
      const nextMessages = targetId
        ? failureMessage
          ? currentMessages.map((message) =>
              message.id === targetId ? { ...message, content: failureMessage } : message,
            )
          : currentMessages.filter(
              (message) =>
                !(
                  message.id === targetId &&
                  message.role === 'assistant' &&
                  !(message.content ?? '').trim()
                ),
            )
        : currentMessages

      assistantMessageIdRef.current = null
      updateSession(problemId, {
        messages: nextMessages,
        isStreaming: false,
        assistantMessageId: null,
        ...patch,
      })
    },
    [
      clearTokenBuffer,
      clearStreamingNodes,
      flushTokenBuffer,
      handleCloseStream,
      problemId,
      updateSession,
    ],
  )

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
          initSession(problemId, [INITIAL_MESSAGE])
        }
      } catch (error) {
        if (isActive) {
          const status = error?.response?.status
          if (status === 404) {
            setLoadError('존재하지 않는 문제입니다.')
            setProblemStatus(null)
            window.alert('존재하지 않는 문제입니다.')
            navigate('/problems')
            return
          }
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
  }, [initSession, navigate, problemId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isStreaming])

  useEffect(() => {
    checkIsAtBottom()
  }, [checkIsAtBottom, messages, isStreaming])

  useEffect(() => {
    const handleScroll = () => {
      checkIsAtBottom()
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('resize', handleScroll)
    handleScroll()

    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleScroll)
    }
  }, [checkIsAtBottom])

  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) {
      setKeyboardOffset(0)
      return
    }
    let raf = null

    const syncKeyboardOffset = () => {
      if (raf) {
        cancelAnimationFrame(raf)
      }
      raf = requestAnimationFrame(() => {
        const offset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
        setKeyboardOffset(offset)
      })
    }

    viewport.addEventListener('resize', syncKeyboardOffset)
    viewport.addEventListener('scroll', syncKeyboardOffset)
    syncKeyboardOffset()

    return () => {
      viewport.removeEventListener('resize', syncKeyboardOffset)
      viewport.removeEventListener('scroll', syncKeyboardOffset)
      if (raf) {
        cancelAnimationFrame(raf)
      }
    }
  }, [])

  const effectiveKeyboardOffset = keyboardOffset

  useEffect(() => {
    assistantMessageIdRef.current = assistantMessageId
  }, [assistantMessageId])

  useEffect(() => {
    if (isStreaming && conversationId && !streamRef.current) {
      streamRef.current = createChatbotStream(conversationId, {
        onToken: (chunk) => {
          if (chunk) {
            handleAppendAssistant(chunk)
          }
        },
        onFinal: (eventData) => {
          const finalMessage = eventData?.result?.ai_message ?? eventData?.result?.aiMessage
          if (finalMessage) {
            handleReplaceAssistant(finalMessage)
          }
          didReceiveFinalRef.current = true
          const isCorrect = eventData?.result?.is_correct ?? eventData?.result?.isCorrect
          const currentNode = eventData?.result?.current_node ?? eventData?.result?.currentNode
          if (isCorrect === true && currentNode === 'RULE') {
            handleMarkSummaryReady(assistantMessageIdRef.current)
          }
        },
        onStatus: (status) => {
          if (status === 'COMPLETED') {
            if (didReceiveFinalRef.current) {
              handleStopStreaming()
            }
            return
          }

          if (status === 'FAILED') {
            handleStopStreaming({ failureMessage: STREAM_FAILED_MESSAGE })
            return
          }
        },
        onError: () => {
          handleStopStreaming({ failureMessage: STREAM_FAILED_MESSAGE })
          return
        },
      })
    }
  }, [
    conversationId,
    handleAppendAssistant,
    handleReplaceAssistant,
    handleMarkSummaryReady,
    handleStopStreaming,
    isStreaming,
    problemId,
  ])

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.close()
        streamRef.current = null
      }
      clearTokenBuffer()
      clearStreamingNodes()
    }
  }, [clearTokenBuffer, clearStreamingNodes])

  const handleSend = async () => {
    const trimmed = inputValue.trim()
    if (!trimmed || !problemId || isStreaming) {
      return
    }

    updateSession(problemId, { sendError: null, inputValue: '', conversationId: null })
    clearTokenBuffer()
    clearStreamingNodes()
    didReceiveFinalRef.current = false

    const userMessage = {
      id: buildMessageId(),
      role: 'user',
      content: trimmed,
    }
    const assistantId = buildMessageId()
    assistantMessageIdRef.current = assistantId

    updateSession(problemId, {
      assistantMessageId: assistantId,
      messages: [...messages, userMessage, { id: assistantId, role: 'assistant', content: '' }],
      isStreaming: true,
    })

    try {
      const response = await sendChatbotMessage({
        problemId,
        message: trimmed,
      })

      if (response.status === 'COMPLETED') {
        handleStopStreaming()
        return
      }

      if (response.status === 'FAILED') {
        handleStopStreaming({ failureMessage: STREAM_FAILED_MESSAGE })
        return
      }

      if (!response.conversationId) {
        handleStopStreaming({ failureMessage: STREAM_FAILED_MESSAGE })
        return
      }

      updateSession(problemId, {
        conversationId: response.conversationId,
        isStreaming: true,
      })
    } catch {
      handleStopStreaming({ failureMessage: STREAM_FAILED_MESSAGE })
    }
  }

  const handleScrollBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleInputFocus = () => {
    window.setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 120)
  }

  const handleSummaryCtaClick = useCallback(() => {
    if (problemId) {
      navigate(`/problems/${problemId}/summary`)
    }
  }, [navigate, problemId])

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
                  tab.id === ACTIVE_TAB_ID ? 'text-info' : 'text-neutral-500'
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
                    tab.id === ACTIVE_TAB_ID ? 'bg-info' : 'bg-transparent'
                  }`}
                />
              </button>
            )
          })}
        </div>
      </div>

      <p className="text-sm text-neutral-500">
        ※ AI가 생성한 답변은 정확하지 않을 수 있으며, 참고용으로만 제공됩니다.
      </p>

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
          <div className="flex-1 space-y-10 pb-32">
            {messages.map((message) => {
              const isPending =
                message.role === 'assistant' &&
                isStreaming &&
                message.id === assistantMessageId &&
                !message.content
              return (
                <ChatMessage
                  key={message.id}
                  isPending={isPending}
                  message={message}
                  onSummaryClick={handleSummaryCtaClick}
                  setStreamingTextNode={isPending ? setStreamingTextNode : undefined}
                  setTypingNode={isPending ? setTypingNode : undefined}
                />
              )
            })}
            <div ref={bottomRef} />
          </div>

          {sendError ? <p className="text-xs text-red-500">{sendError}</p> : null}

          <div
            className="fixed left-1/2 z-20 w-full max-w-[430px] -translate-x-1/2 bg-background/95 px-4 pb-2 pt-2 backdrop-blur"
            style={{ bottom: `calc(var(--chatbot-input-bottom) + ${effectiveKeyboardOffset}px)` }}
          >
            <p className="m-2 text-right text-[12px] text-neutral-500">
              {inputValue.length} / {MAX_INPUT_LENGTH}
            </p>
            <form
              className="flex items-end gap-2 rounded-2xl border border-muted-foreground/20 bg-background p-2 shadow-sm"
              onSubmit={(event) => {
                event.preventDefault()
                handleSend()
              }}
            >
              <Input
                className="h-10 flex-1 border-0 px-2 text-[16px] placeholder:text-neutral-500 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                disabled={isStreaming}
                maxLength={500}
                onChange={(event) => {
                  const nextValue = event.target.value
                  updateSession(problemId, { inputValue: nextValue.slice(0, 500) })
                }}
                onFocus={handleInputFocus}
                placeholder="메시지를 입력하세요"
                ref={inputRef}
                value={inputValue}
              />
              <Button
                className={`h-10 rounded-xl ${
                  inputValue.trim().length > 0 && !isStreaming
                    ? 'bg-info text-white hover:bg-info/90'
                    : ''
                }`}
                disabled={isStreaming || inputValue.trim().length === 0}
                size="sm"
                type="submit"
                variant="secondary"
              >
                <Send className="h-4 w-4" />
                전송
              </Button>
            </form>
          </div>
        </div>
      )}

      {!isAtBottom ? (
        <Button
          aria-label="맨 아래로 이동"
          className="fixed right-6 z-20 h-10 w-10 rounded-full border border-muted bg-background shadow-md"
          style={{
            bottom: `calc(var(--chatbot-input-bottom) + ${effectiveKeyboardOffset}px + 88px)`,
          }}
          onClick={handleScrollBottom}
          size="icon"
          type="button"
          variant="outline"
        >
          <ArrowDown className="h-4 w-4" />
        </Button>
      ) : null}
    </div>
  )
}
