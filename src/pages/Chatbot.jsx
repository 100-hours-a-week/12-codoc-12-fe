import { ArrowDown, BookOpen, Brain, ChevronRight, Clover, Send } from 'lucide-react'
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkBreaks from 'remark-breaks'
import remarkGfm from 'remark-gfm'

import SessionTimer from '@/components/SessionTimer'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { trackEvent } from '@/lib/ga4'
import { isSessionExpired, isSessionRequiredError } from '@/lib/session'
import {
  createChatbotStream,
  getAllChatbotConversations,
  stopChatbotStream,
} from '@/services/chatbot/chatbotService'
import { getProblemDetail, startProblemSession } from '@/services/problems/problemsService'
import { useChatbotStore } from '@/stores/useChatbotStore'
import { useProblemDetailStore } from '@/stores/useProblemDetailStore'
import { useProblemSessionStore } from '@/stores/useProblemSessionStore'

const TAB_ITEMS = [
  { id: 'problem', label: '문제', Icon: BookOpen },
  { id: 'chatbot', label: 'AI 챗봇', Icon: Brain },
  { id: 'quiz', label: '퀴즈', Icon: Clover },
]

const ACTIVE_TAB_ID = 'chatbot'

const MAX_INPUT_LENGTH = 500
const STREAM_FAILED_MESSAGE = '답변 생성에 실패했습니다.'
const STREAM_RATE_LIMIT_MESSAGE = '요청 횟수를 초과했습니다. 잠시 후 다시 시도해주세요.'
const STREAM_RENDER_BASE_CPS = 44
const STREAM_RENDER_BACKLOG_CPS = 72
const STREAM_RENDER_MAX_CHARS_PER_FRAME = 6
const FINAL_CHATBOT_NODE = 'INSIGHT'
const CHATBOT_COMPLETED_GUIDE_TEXT =
  '챗봇 단계가 모두 완료되었습니다. 이제 요약 카드를 만들고 퀴즈를 풀어보세요!'
const HISTORY_FALLBACK_MESSAGE_BY_STATUS = {
  CANCELED: '답변 생성이 중단되었습니다',
  FAILED: STREAM_FAILED_MESSAGE,
}

const INITIAL_MESSAGE = {
  id: 'assistant-intro',
  role: 'assistant',
  content:
    '안녕하세요! 코독이에요.\n지금부터 문제를 4단계로 쪼개 요약카드를 완성해봅시다.\n1단계는 “문제 배경(상황)”입니다.\n지금 어떤 상황인지 말해주세요.\n(누가/무엇을/얼마나를 잡아내면 좋습니다)',
}

const CHATBOT_COMPLETED_GUIDE_MESSAGE = {
  id: 'assistant-chatbot-completed-guide',
  role: 'assistant',
  content: CHATBOT_COMPLETED_GUIDE_TEXT,
}

const buildMessageId = () => `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const normalizeConversationStatus = (status) =>
  String(status ?? '')
    .trim()
    .toUpperCase()

const normalizeChatbotNode = (node) => (typeof node === 'string' ? node.trim().toUpperCase() : '')

const resolveFinalNode = (result = {}) => {
  const candidates = [
    result.current_node,
    result.currentNode,
    result.paragraph_type,
    result.paragraphType,
  ]

  for (const candidate of candidates) {
    const normalized = normalizeChatbotNode(candidate)
    if (normalized) {
      return normalized
    }
  }

  return ''
}

const resolveHistoryFallbackMessage = (status) => {
  const normalizedStatus = normalizeConversationStatus(status)
  return HISTORY_FALLBACK_MESSAGE_BY_STATUS[normalizedStatus] ?? ''
}

const resolveResumableConversationId = (items = []) => {
  if (!Array.isArray(items) || items.length === 0) {
    return null
  }

  const latestConversation = items[0]
  const latestStatus = normalizeConversationStatus(latestConversation?.status)
  const latestAiMessage = String(latestConversation?.aiMessage ?? '').trim()
  const conversationId = Number(latestConversation?.conversationId)

  const isResumableStatus = latestStatus === 'DISCONNECTED' || latestStatus === 'PROCESSING'
  if (!isResumableStatus || latestAiMessage) {
    return null
  }
  if (!Number.isInteger(conversationId) || conversationId <= 0) {
    return null
  }

  return conversationId
}

const toHistoryMessages = (items = []) => {
  if (!Array.isArray(items) || items.length === 0) {
    return [INITIAL_MESSAGE]
  }

  const historyMessages = [...items].reverse().flatMap((item) => {
    const conversationId = item?.conversationId ?? buildMessageId()
    const userMessage = String(item?.userMessage ?? '').trim()
    const aiMessage = String(item?.aiMessage ?? '').trim()
    const status = normalizeConversationStatus(item?.status)
    const fallbackMessage = resolveHistoryFallbackMessage(status)
    const nextMessages = []

    if (userMessage) {
      nextMessages.push({ id: `conv-${conversationId}-user`, role: 'user', content: userMessage })
    }
    if (aiMessage || fallbackMessage) {
      nextMessages.push({
        id: `conv-${conversationId}-assistant`,
        role: 'assistant',
        content: aiMessage || fallbackMessage,
        meta: fallbackMessage
          ? {
              isFallback: true,
              fallbackStatus: status,
            }
          : undefined,
      })
    }

    return nextMessages
  })

  return historyMessages.length > 0 ? [INITIAL_MESSAGE, ...historyMessages] : [INITIAL_MESSAGE]
}

const ChatMessage = memo(function ChatMessage({
  message,
  isPending,
  setStreamingTextNode,
  setTypingNode,
}) {
  const isUser = message.role === 'user'
  const markdownComponents = useMemo(
    () => ({
      h1: ({ node: _node, ...props }) => (
        <h2 className="mt-6 mb-2 text-lg font-bold text-foreground" {...props} />
      ),
      h2: ({ ...props }) => (
        <h2 className="mt-6 mb-2 text-lg font-bold text-foreground" {...props} />
      ),
      h3: ({ ...props }) => (
        <h3 className="mt-4 mb-2 text-base font-semibold text-foreground" {...props} />
      ),
      h4: ({ node: _node, ...props }) => (
        <h4 className="mt-3 mb-1 text-sm font-semibold text-foreground" {...props} />
      ),
      p: ({ ...props }) => (
        <p className="mb-3 text-[15px] leading-[1.7] text-foreground/90" {...props} />
      ),
      hr: () => (
        <div>
          <br />
          <hr className="border-foreground/10" />
          <br />
        </div>
      ),
      ul: ({ ...props }) => (
        <ul className="mb-3 list-disc space-y-2 pl-5 text-[15px] text-foreground/90" {...props} />
      ),
      ol: ({ ...props }) => (
        <ol
          className="mb-3 list-decimal space-y-2 pl-5 text-[15px] text-foreground/90"
          {...props}
        />
      ),
      li: ({ ...props }) => <li className="leading-relaxed" {...props} />,
      blockquote: ({ node: _node, ...props }) => (
        <blockquote
          className="rounded-xl bg-muted/40 px-4 py-3 text-[15px] leading-[1.6] text-foreground/90"
          {...props}
        />
      ),
      table: ({ node: _node, ...props }) => (
        <div className="my-3 overflow-x-auto">
          <table className="min-w-full text-[13px] leading-relaxed" {...props} />
        </div>
      ),
      thead: ({ node: _node, ...props }) => <thead className="bg-muted/60" {...props} />,
      tbody: ({ node: _node, ...props }) => <tbody {...props} />,
      tr: ({ node: _node, ...props }) => <tr className="border-b border-border" {...props} />,
      th: ({ node: _node, ...props }) => (
        <th className="px-3 py-2 text-left text-xs font-semibold text-foreground/80" {...props} />
      ),
      td: ({ node: _node, ...props }) => (
        <td className="px-3 py-2 align-top text-xs text-foreground/90" {...props} />
      ),
      pre: ({ ...props }) => (
        <pre
          className="my-3 overflow-x-auto rounded-xl bg-muted px-4 py-3 text-sm leading-relaxed"
          {...props}
        />
      ),
      code: ({ node: _node, inline, className, children, ...props }) =>
        inline ? (
          <code
            className="rounded bg-muted/60 px-1.5 py-0.5 text-[0.85em] text-foreground/90"
            {...props}
          >
            {children}
          </code>
        ) : (
          <code className={className} {...props}>
            {children}
          </code>
        ),
    }),
    [],
  )
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
            ) : message.meta?.isFallback ? (
              <div className="inline-flex rounded-2xl">
                <p className="whitespace-pre-line text-[14px] font-semibold leading-6 text-amber-900">
                  {message.content}
                </p>
              </div>
            ) : (
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkBreaks]}
                components={markdownComponents}
              >
                {message.content}
              </ReactMarkdown>
            )}
          </div>
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
  const [isSessionStarting, setIsSessionStarting] = useState(false)
  const [sessionError, setSessionError] = useState(null)
  const [isSessionRequired, setIsSessionRequired] = useState(false)

  const { sessions, initSession, updateSession } = useChatbotStore()
  const session = problemId ? sessions[String(problemId)] : null
  const { sessions: problemSessions, setSession: setProblemSession } = useProblemSessionStore()
  const { fetchProblem: fetchProblemDetail } = useProblemDetailStore()
  const problemSession = problemId ? problemSessions[String(problemId)] : null
  const sessionId = problemSession?.sessionId ?? null
  const isExpired = isSessionExpired(problemSession?.expiresAt)
  const hasActiveSession = Boolean(sessionId) && !isExpired
  const activeSession = useMemo(() => {
    const items = Object.values(problemSessions)
    return items.find((entry) => entry?.sessionId) ?? null
  }, [problemSessions])
  const isActiveSessionExpired = isSessionExpired(activeSession?.expiresAt)
  const hasOtherActiveSession =
    Boolean(activeSession?.sessionId) &&
    !isActiveSessionExpired &&
    String(activeSession?.problemId ?? '') !== String(problemId ?? '')
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
  const drainRafRef = useRef(null)
  const drainBudgetRef = useRef(0)
  const lastDrainTimestampRef = useRef(0)
  const autoScrollRafRef = useRef(null)
  const streamPayloadRef = useRef(null)
  const messagesViewportRef = useRef(null)
  const inputRef = useRef(null)
  const isAtBottomRef = useRef(true)
  const hasInitialViewportSyncRef = useRef(false)
  const previousMessagesLengthRef = useRef(0)

  useEffect(() => {
    if (!problemId) {
      return
    }
    trackEvent('chatbot_view', { problem_id: String(problemId) })
  }, [problemId])

  const handleCloseStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.close()
      streamRef.current = null
    }
  }, [])

  const clearTokenBuffer = useCallback(() => {
    tokenBufferRef.current = ''
    if (drainRafRef.current) {
      cancelAnimationFrame(drainRafRef.current)
      drainRafRef.current = null
    }
    drainBudgetRef.current = 0
    lastDrainTimestampRef.current = 0
  }, [])

  const clearStreamingNodes = useCallback(() => {
    streamingTextRef.current = null
    typingIndicatorRef.current = null
    streamPayloadRef.current = null
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
    if (isAtBottomRef.current && !autoScrollRafRef.current) {
      autoScrollRafRef.current = requestAnimationFrame(() => {
        autoScrollRafRef.current = null
        const viewport = messagesViewportRef.current
        if (!viewport) {
          return
        }
        viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'auto' })
      })
    }
  }, [])

  const flushTokenBufferImmediately = useCallback(() => {
    if (!tokenBufferRef.current || !streamingTextRef.current) {
      return
    }
    const chunk = tokenBufferRef.current
    tokenBufferRef.current = ''
    drainBudgetRef.current = 0
    lastDrainTimestampRef.current = 0
    appendToAssistant(chunk)
  }, [appendToAssistant])

  const getCharsPerSecond = useCallback((queuedLength) => {
    const backlogBoost = Math.min(STREAM_RENDER_BACKLOG_CPS, queuedLength * 0.25)
    return STREAM_RENDER_BASE_CPS + backlogBoost
  }, [])

  const drainTokenBuffer = useCallback(
    (timestamp) => {
      drainRafRef.current = null

      if (!assistantMessageIdRef.current) {
        tokenBufferRef.current = ''
        drainBudgetRef.current = 0
        lastDrainTimestampRef.current = 0
        return
      }

      if (!streamingTextRef.current) {
        drainRafRef.current = requestAnimationFrame(drainTokenBuffer)
        return
      }

      const queuedText = tokenBufferRef.current
      if (!queuedText) {
        drainBudgetRef.current = 0
        lastDrainTimestampRef.current = 0
        return
      }

      const prevTimestamp = lastDrainTimestampRef.current || timestamp
      const elapsedMs = Math.max(0, timestamp - prevTimestamp)
      lastDrainTimestampRef.current = timestamp

      const charsPerSecond = getCharsPerSecond(queuedText.length)
      drainBudgetRef.current += (elapsedMs * charsPerSecond) / 1000

      const drainSize = Math.min(
        queuedText.length,
        STREAM_RENDER_MAX_CHARS_PER_FRAME,
        Math.floor(drainBudgetRef.current),
      )

      if (drainSize > 0) {
        const nextChunk = queuedText.slice(0, drainSize)
        tokenBufferRef.current = queuedText.slice(drainSize)
        drainBudgetRef.current -= drainSize
        appendToAssistant(nextChunk)
      }

      if (tokenBufferRef.current) {
        drainRafRef.current = requestAnimationFrame(drainTokenBuffer)
        return
      }
      drainBudgetRef.current = 0
      lastDrainTimestampRef.current = 0
    },
    [appendToAssistant, getCharsPerSecond],
  )

  const startTokenDrain = useCallback(() => {
    if (drainRafRef.current || !tokenBufferRef.current) {
      return
    }
    drainBudgetRef.current = Math.max(1, drainBudgetRef.current)
    drainRafRef.current = requestAnimationFrame(drainTokenBuffer)
  }, [drainTokenBuffer])

  const setStreamingTextNode = useCallback(
    (node) => {
      streamingTextRef.current = node
      if (node) {
        node.textContent = ''
        startTokenDrain()
      }
    },
    [startTokenDrain],
  )

  const setTypingNode = useCallback((node) => {
    typingIndicatorRef.current = node
    if (node) {
      node.style.display = ''
    }
  }, [])

  const handleAppendAssistant = useCallback(
    (text) => {
      if (!text) {
        return
      }
      tokenBufferRef.current = `${tokenBufferRef.current}${text}`
      startTokenDrain()
    },
    [startTokenDrain],
  )

  const checkIsAtBottom = useCallback(() => {
    const viewport = messagesViewportRef.current
    if (!viewport) {
      isAtBottomRef.current = true
      setIsAtBottom(true)
      return
    }

    const remaining = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight
    const nextIsAtBottom = remaining < 32
    isAtBottomRef.current = nextIsAtBottom
    setIsAtBottom(nextIsAtBottom)
  }, [])

  const scrollToBottom = useCallback((behavior = 'auto') => {
    const viewport = messagesViewportRef.current
    if (!viewport) {
      return
    }

    viewport.scrollTo({ top: viewport.scrollHeight, behavior })
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

  const handleMarkQuizReady = useCallback(
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
                  showQuizCta: true,
                },
              }
            : message,
        ),
      })
    },
    [problemId, updateSession],
  )

  const handleCompleteChatbotSession = useCallback(() => {
    if (!problemId) {
      return
    }

    const completedAt = new Date().toISOString()
    updateSession(problemId, {
      isChatbotCompleted: true,
      inputValue: '',
      sendError: null,
    })
    if (problemSession?.sessionId) {
      setProblemSession(problemId, {
        ...problemSession,
        chatbotCompletedAt: problemSession.chatbotCompletedAt ?? completedAt,
      })
    }
  }, [problemId, problemSession, setProblemSession, updateSession])

  const handleStopStreaming = useCallback(
    ({ failureMessage, fallbackStatus, patch = {} } = {}) => {
      if (!problemId) {
        return
      }

      if (!failureMessage) {
        flushTokenBufferImmediately()
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
              message.id === targetId
                ? {
                    ...message,
                    content: failureMessage,
                    meta: fallbackStatus
                      ? {
                          ...(message.meta ?? {}),
                          isFallback: true,
                          fallbackStatus,
                        }
                      : message.meta,
                  }
                : message,
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
        conversationId: null,
        isStreaming: false,
        assistantMessageId: null,
        ...patch,
      })
    },
    [
      clearTokenBuffer,
      clearStreamingNodes,
      flushTokenBufferImmediately,
      handleCloseStream,
      problemId,
      updateSession,
    ],
  )

  useEffect(() => {
    hasInitialViewportSyncRef.current = false
    previousMessagesLengthRef.current = 0
  }, [problemId, sessionId])

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
      setIsSessionRequired(false)

      try {
        const existingSession = useChatbotStore.getState().sessions[String(problemId)]
        const data = await fetchProblemDetail(problemId, getProblemDetail)
        let history = { items: [] }
        if (sessionId && !existingSession) {
          history = await getAllChatbotConversations(problemId, { sessionId })
        }
        if (isActive) {
          setProblemStatus(data.status)
          if (sessionId) {
            const isChatbotCompletedBySession = Boolean(problemSession?.chatbotCompletedAt)
            const isChatbotCompletedByStatus = ['summary_card_passed', 'solved'].includes(
              data.status ?? '',
            )
            const isChatbotCompletedState =
              isChatbotCompletedBySession || isChatbotCompletedByStatus
            const historyItems = Array.isArray(history?.items) ? history.items : []
            const historyMessages = toHistoryMessages(historyItems)
            initSession(problemId, historyMessages)
            updateSession(problemId, {
              isChatbotCompleted: isChatbotCompletedState,
              ...(isChatbotCompletedState ? { inputValue: '' } : {}),
            })

            if (!existingSession && !isChatbotCompletedState) {
              const resumableConversationId = resolveResumableConversationId(historyItems)
              if (resumableConversationId) {
                const pendingAssistantId = `conv-${resumableConversationId}-assistant`
                const hasAssistantMessage = historyMessages.some(
                  (message) => message.id === pendingAssistantId && message.role === 'assistant',
                )
                const resumeMessages = hasAssistantMessage
                  ? historyMessages
                  : [
                      ...historyMessages,
                      {
                        id: pendingAssistantId,
                        role: 'assistant',
                        content: '',
                      },
                    ]

                assistantMessageIdRef.current = pendingAssistantId
                streamPayloadRef.current = { conversationId: resumableConversationId }
                updateSession(problemId, {
                  messages: resumeMessages,
                  conversationId: resumableConversationId,
                  assistantMessageId: pendingAssistantId,
                  isStreaming: true,
                  sendError: null,
                })
              }
            }
          }
        }
      } catch (error) {
        if (isActive) {
          if (isSessionRequiredError(error)) {
            setIsSessionRequired(true)
            setProblemStatus(null)
            return
          }
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
  }, [
    fetchProblemDetail,
    initSession,
    navigate,
    problemId,
    problemSession?.chatbotCompletedAt,
    sessionId,
    updateSession,
  ])

  useLayoutEffect(() => {
    if (isLoading || loadError || isSessionRequired || !hasActiveSession) {
      return
    }

    if (hasInitialViewportSyncRef.current) {
      return
    }

    scrollToBottom('auto')
    hasInitialViewportSyncRef.current = true
    previousMessagesLengthRef.current = messages.length
    isAtBottomRef.current = true
    setIsAtBottom(true)
  }, [hasActiveSession, isLoading, isSessionRequired, loadError, messages.length, scrollToBottom])

  useEffect(() => {
    if (isLoading || loadError || isSessionRequired || !hasActiveSession) {
      return
    }
    if (!hasInitialViewportSyncRef.current) {
      return
    }

    const previousLength = previousMessagesLengthRef.current
    previousMessagesLengthRef.current = messages.length

    if (messages.length <= previousLength) {
      return
    }

    scrollToBottom(messages.length <= 1 ? 'auto' : 'smooth')
  }, [hasActiveSession, isLoading, isSessionRequired, loadError, messages.length, scrollToBottom])

  useEffect(() => {
    if (isLoading || loadError || isSessionRequired || !hasActiveSession) {
      return
    }

    const viewport = messagesViewportRef.current
    if (!viewport) {
      return
    }

    const handleViewportScroll = () => {
      checkIsAtBottom()
    }

    viewport.addEventListener('scroll', handleViewportScroll, { passive: true })
    handleViewportScroll()

    return () => {
      viewport.removeEventListener('scroll', handleViewportScroll)
    }
  }, [checkIsAtBottom, hasActiveSession, isLoading, isSessionRequired, loadError])

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
  const inputBottomOffset = `calc(var(--chatbot-input-bottom) + env(safe-area-inset-bottom) + ${effectiveKeyboardOffset}px)`

  useEffect(() => {
    assistantMessageIdRef.current = assistantMessageId
  }, [assistantMessageId])

  useEffect(() => {
    if (isStreaming && streamPayloadRef.current && !streamRef.current) {
      streamRef.current = createChatbotStream(streamPayloadRef.current, {
        onAccepted: ({ conversationId: acceptedConversationId }) => {
          if (!problemId || !acceptedConversationId) {
            return
          }
          const currentSession = useChatbotStore.getState().sessions[String(problemId)]
          if (!currentSession?.isStreaming) {
            return
          }
          updateSession(problemId, { conversationId: acceptedConversationId })
        },
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
          const currentNode = resolveFinalNode(eventData?.result)
          if (isCorrect === true && currentNode === FINAL_CHATBOT_NODE) {
            handleMarkQuizReady(assistantMessageIdRef.current)
            handleCompleteChatbotSession()
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
            handleStopStreaming({ failureMessage: STREAM_FAILED_MESSAGE, fallbackStatus: 'FAILED' })
            return
          }
        },
        onError: () => {
          handleStopStreaming({ failureMessage: STREAM_FAILED_MESSAGE, fallbackStatus: 'FAILED' })
          return
        },
        onConflict: ({ isResumeStreamRequest }) => {
          if (isResumeStreamRequest) {
            handleStopStreaming({
              failureMessage: STREAM_FAILED_MESSAGE,
              fallbackStatus: 'FAILED',
            })
            return
          }

          handleCompleteChatbotSession()
          handleStopStreaming()
        },
        onRateLimit: ({ message }) => {
          const rateLimitMessage = message ?? STREAM_RATE_LIMIT_MESSAGE
          handleStopStreaming({
            failureMessage: rateLimitMessage,
            patch: {
              isInputBlocked: false,
              sendError: null,
            },
          })
        },
        onSessionRequired: () => {
          handleStopStreaming()
          setIsSessionRequired(true)
        },
      })
      streamPayloadRef.current = null
    }
  }, [
    handleCompleteChatbotSession,
    handleAppendAssistant,
    handleReplaceAssistant,
    handleMarkQuizReady,
    handleStopStreaming,
    isStreaming,
    problemId,
    updateSession,
  ])

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.close()
        streamRef.current = null
      }
      clearTokenBuffer()
      clearStreamingNodes()
      if (autoScrollRafRef.current) {
        cancelAnimationFrame(autoScrollRafRef.current)
        autoScrollRafRef.current = null
      }
    }
  }, [clearTokenBuffer, clearStreamingNodes])

  const handleSend = async () => {
    const trimmed = inputValue.trim()
    if (!trimmed || !problemId || isStreaming || isChatbotCompleted) {
      return
    }

    updateSession(problemId, { sendError: null, inputValue: '' })
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
      conversationId: null,
      isStreaming: true,
    })

    streamPayloadRef.current = { problemId, message: trimmed, sessionId }
  }

  const handleCancelStream = useCallback(async () => {
    if (!problemId || !isStreaming) {
      return
    }

    const currentConversationId =
      useChatbotStore.getState().sessions[String(problemId)]?.conversationId ?? conversationId

    handleStopStreaming({
      failureMessage: resolveHistoryFallbackMessage('CANCELED'),
      fallbackStatus: 'CANCELED',
    })

    if (!currentConversationId) {
      return
    }

    try {
      await stopChatbotStream(currentConversationId)
    } catch {
      // ignore API cancel failures; UI already switched to canceled
    }
  }, [conversationId, handleStopStreaming, isStreaming, problemId])

  const handleScrollBottom = () => {
    scrollToBottom('smooth')
  }

  const handleInputFocus = () => {
    window.setTimeout(() => {
      scrollToBottom('smooth')
    }, 120)
  }

  useEffect(() => {
    const inputEl = inputRef.current
    if (!inputEl) {
      return
    }

    inputEl.style.height = '0px'
    const nextHeight = Math.min(inputEl.scrollHeight, 120)
    inputEl.style.height = `${nextHeight}px`
    inputEl.style.overflowY = inputEl.scrollHeight > 120 ? 'auto' : 'hidden'
  }, [inputValue])

  const handleInputKeyDown = (event) => {
    if (event.key !== 'Enter') {
      return
    }
    if (event.nativeEvent?.isComposing || event.shiftKey) {
      return
    }

    event.preventDefault()
    event.currentTarget.form?.requestSubmit()
  }

  const handleQuizCtaClick = useCallback(() => {
    if (problemId) {
      navigate(`/problems/${problemId}/quiz`)
    }
  }, [navigate, problemId])

  const handleSummaryCtaClick = useCallback(() => {
    if (problemId) {
      navigate(`/problems/${problemId}/summary`)
    }
  }, [navigate, problemId])

  const handleStartSession = async () => {
    if (!problemId || isSessionStarting) {
      return
    }
    setIsSessionStarting(true)
    setSessionError(null)
    try {
      const response = await startProblemSession(problemId)
      setProblemSession(problemId, response)
      updateSession(problemId, {
        messages: [INITIAL_MESSAGE],
        inputValue: '',
        conversationId: null,
        assistantMessageId: null,
        isStreaming: false,
        isChatbotCompleted: false,
        isInputBlocked: false,
        sendError: null,
      })
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

  const isQuizEnabled = useMemo(
    () => ['summary_card_passed', 'solved'].includes(problemStatus ?? ''),
    [problemStatus],
  )
  const isChatbotCompleted = useMemo(
    () =>
      Boolean(session?.isChatbotCompleted) ||
      Boolean(problemSession?.chatbotCompletedAt) ||
      isQuizEnabled,
    [isQuizEnabled, problemSession?.chatbotCompletedAt, session?.isChatbotCompleted],
  )
  const renderedMessages = useMemo(
    () => (isChatbotCompleted ? [...messages, CHATBOT_COMPLETED_GUIDE_MESSAGE] : messages),
    [isChatbotCompleted, messages],
  )

  useEffect(() => {
    if (!isChatbotCompleted || isLoading || loadError || isSessionRequired || !hasActiveSession) {
      return
    }

    scrollToBottom('smooth')
  }, [
    hasActiveSession,
    isChatbotCompleted,
    isLoading,
    isSessionRequired,
    loadError,
    scrollToBottom,
  ])

  return (
    <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden px-4">
      <div className="shrink-0 space-y-4 pt-5">
        <div className="rounded-2xl bg-muted/70 px-2 shadow-sm">
          <div className="grid grid-cols-3">
            {TAB_ITEMS.map((tab) => {
              const isQuizTab = tab.id === 'quiz'
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
                    if (!problemId || !isEnabled) {
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

        {hasActiveSession ? (
          <div className="!mt-0 flex justify-end">
            <SessionTimer expiresAt={problemSession?.expiresAt} />
          </div>
        ) : null}
      </div>

      {isLoading ? (
        <div className="min-h-0 flex-1 overflow-y-auto pb-6">
          <Card className="border-dashed border-muted-foreground/40 bg-muted/40 p-6 text-center">
            <p className="text-sm text-muted-foreground">챗봇을 준비하는 중입니다.</p>
          </Card>
        </div>
      ) : loadError ? (
        <div className="min-h-0 flex-1 overflow-y-auto pb-6">
          <Card className="border-dashed border-muted-foreground/40 bg-muted/40 p-6 text-center">
            <p className="text-sm text-red-500">{loadError}</p>
            <Button className="mt-4" onClick={() => window.location.reload()} variant="secondary">
              다시 시도
            </Button>
          </Card>
        </div>
      ) : isSessionRequired || !hasActiveSession ? (
        <div className="min-h-0 flex-1 overflow-y-auto pb-6">
          <Card className="border-dashed border-muted-foreground/40 bg-muted/40 p-6 text-center">
            <p className="text-sm text-muted-foreground">
              {isExpired || isSessionRequired
                ? '세션이 만료되었습니다. 다시 시작해주세요.'
                : '문제 풀이를 시작해야 챗봇을 사용할 수 있어요.'}
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
        </div>
      ) : (
        <div className="relative min-h-0 flex flex-1 flex-col overflow-hidden">
          <div
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-4 pt-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            ref={messagesViewportRef}
          >
            <div className="space-y-10">
              {renderedMessages.map((message) => {
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
                    setStreamingTextNode={isPending ? setStreamingTextNode : undefined}
                    setTypingNode={isPending ? setTypingNode : undefined}
                  />
                )
              })}
            </div>
          </div>

          {!isAtBottom ? (
            <div
              className="pointer-events-none absolute left-4 right-4 z-20"
              style={{ bottom: `calc(${inputBottomOffset} + 88px)` }}
            >
              <div className="flex justify-end">
                <Button
                  aria-label="맨 아래로 이동"
                  className="pointer-events-auto h-10 w-10 rounded-full border border-muted bg-background shadow-md"
                  onClick={handleScrollBottom}
                  size="icon"
                  type="button"
                  variant="outline"
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : null}

          <div
            className="shrink-0 bg-background/95 pt-2 backdrop-blur"
            style={{ paddingBottom: inputBottomOffset }}
          >
            {sendError ? <p className="m-2 text-xs text-red-500">{sendError}</p> : null}

            {isChatbotCompleted ? (
              <div className="space-y-2 rounded-2xl bg-background shadow-sm">
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    className="h-auto w-full rounded-2xl border-black bg-background px-3 py-3 text-left text-black hover:bg-muted/20"
                    onClick={handleSummaryCtaClick}
                    type="button"
                    variant="outline"
                  >
                    <span className="flex w-full items-center gap-2">
                      <span className="min-w-0 flex-1 overflow-hidden">
                        <span className="block truncate break-keep text-[13px] font-semibold leading-5">
                          문제 요약 카드 만들기
                        </span>
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0" />
                    </span>
                  </Button>
                  <Button
                    className="h-auto w-full rounded-2xl border-black bg-background px-3 py-3 text-left text-black hover:bg-muted/20"
                    onClick={handleQuizCtaClick}
                    type="button"
                    variant="outline"
                  >
                    <span className="flex w-full items-center gap-2">
                      <span className="min-w-0 flex-1 overflow-hidden">
                        <span className="block truncate break-keep text-[13px] font-semibold leading-5">
                          퀴즈 풀기
                        </span>
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0" />
                    </span>
                  </Button>
                </div>
              </div>
            ) : (
              <>
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
                  <label className="sr-only" htmlFor="chatbot-message-input">
                    메시지 입력
                  </label>
                  <textarea
                    id="chatbot-message-input"
                    className="min-h-10 max-h-[120px] flex-1 resize-none border-0 px-2 py-2 text-[16px] leading-6 placeholder:text-neutral-500 shadow-none focus-visible:outline-none"
                    disabled={isStreaming}
                    maxLength={MAX_INPUT_LENGTH}
                    onChange={(event) => {
                      const nextValue = event.target.value
                      updateSession(problemId, {
                        inputValue: nextValue.slice(0, MAX_INPUT_LENGTH),
                      })
                    }}
                    onKeyDown={handleInputKeyDown}
                    onFocus={handleInputFocus}
                    placeholder="메시지를 입력하세요"
                    ref={inputRef}
                    rows={1}
                    value={inputValue}
                  />
                  {isStreaming ? (
                    <Button
                      className="h-10 rounded-xl"
                      onClick={handleCancelStream}
                      size="sm"
                      type="button"
                      variant="destructive"
                    >
                      중단
                    </Button>
                  ) : (
                    <Button
                      className={`h-10 rounded-xl ${
                        inputValue.trim().length > 0 ? 'bg-info text-white hover:bg-info/90' : ''
                      }`}
                      disabled={inputValue.trim().length === 0}
                      size="sm"
                      type="submit"
                      variant="secondary"
                    >
                      <Send className="h-4 w-4" />
                      전송
                    </Button>
                  )}
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
