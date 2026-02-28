import { ArrowDown, LogOut, Send } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'

import StatusMessage from '@/components/StatusMessage'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { getAccessTokenPayload } from '@/lib/auth'
import { toChatMessageItem } from '@/services/chat/chatDto'
import {
  createChatStompConnection,
  toChatMessageSendDestination,
  toChatRoomTopic,
} from '@/services/chat/chatRealtime'
import { getChatRoomMessages, leaveChatRoom } from '@/services/chat/chatService'
import { useChatRealtimeStore } from '@/stores/useChatRealtimeStore'

const PAGE_LIMIT = 30
const MAX_INPUT_LENGTH = 500
const SEND_RETRY_DELAY_MS = 700

const toCurrentUserId = () => {
  const payload = getAccessTokenPayload()
  const parsed = Number(payload?.userId ?? payload?.sub)

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null
  }

  return parsed
}

const toMessageLoadError = (error) => {
  const code = error?.response?.data?.code

  if (code === 'CHAT_ROOM_NOT_FOUND') {
    return '채팅방을 찾을 수 없습니다.'
  }

  return '메시지를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.'
}

const toLeaveErrorMessage = (error) => {
  const code = error?.response?.data?.code

  if (code === 'CHAT_ROOM_NOT_FOUND') {
    return '채팅방을 찾을 수 없습니다.'
  }
  if (code === 'NO_CHAT_ROOM_PARTICIPANT') {
    return '이미 퇴장한 채팅방입니다.'
  }

  return '채팅방 퇴장에 실패했습니다. 잠시 후 다시 시도해주세요.'
}

const SYSTEM_MESSAGE_TYPES = new Set(['SYSTEM', 'INIT'])

const pad2 = (value) => String(value).padStart(2, '0')

const toValidDate = (value) => {
  const date = new Date(value ?? '')
  return Number.isNaN(date.getTime()) ? null : date
}

const toMessageTimeLabel = (message) => {
  const date = toValidDate(message?.createdAt)
  if (!date) {
    return ''
  }

  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}

const toMessageDateKey = (message) => {
  const date = toValidDate(message?.createdAt)
  if (!date) {
    return null
  }

  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

const toMessageDateLabel = (message) => {
  const date = toValidDate(message?.createdAt)
  if (!date) {
    return ''
  }

  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`
}

const toCreatedAtTime = (message) => {
  const value = Date.parse(message?.createdAt ?? '')
  return Number.isFinite(value) ? value : 0
}

const toNumericMessageId = (message) => {
  const value = Number(message?.messageId)
  return Number.isFinite(value) ? value : null
}

const compareMessagesDesc = (a, b) => {
  const byCreatedAt = toCreatedAtTime(b) - toCreatedAtTime(a)
  if (byCreatedAt !== 0) {
    return byCreatedAt
  }

  const idA = toNumericMessageId(a)
  const idB = toNumericMessageId(b)

  if (idA != null && idB != null && idA !== idB) {
    return idB - idA
  }

  return 0
}

const mergeMessages = (items = []) => {
  const byId = new Map()
  const withoutId = []

  items.forEach((item) => {
    if (item?.messageId == null) {
      withoutId.push(item)
      return
    }

    if (!byId.has(item.messageId)) {
      byId.set(item.messageId, item)
    }
  })

  return [...byId.values(), ...withoutId].sort(compareMessagesDesc)
}

const toSenderLabel = (message, currentUserId) => {
  if (typeof message?.senderNickname === 'string' && message.senderNickname.trim()) {
    return message.senderNickname.trim()
  }

  if (typeof message?.senderName === 'string' && message.senderName.trim()) {
    return message.senderName.trim()
  }

  if (Number.isInteger(message?.senderId)) {
    if (message.senderId === currentUserId) {
      return '나'
    }
    return `참여자 ${message.senderId}`
  }

  return '참여자'
}

function ChatMessageItem({ currentUserId, isMine, message }) {
  const isSystemMessage = SYSTEM_MESSAGE_TYPES.has(message.type)
  const timeLabel = toMessageTimeLabel(message)

  if (isSystemMessage) {
    return (
      <li className="flex justify-center">
        <div className="max-w-[85%] rounded-xl bg-neutral-300 px-3 py-2 text-[11px] text-neutral-700">
          {message.content}
        </div>
      </li>
    )
  }

  if (isMine) {
    return (
      <li className="flex justify-end">
        <div className="flex max-w-[82%] items-end gap-1.5">
          {timeLabel ? (
            <p className="shrink-0 text-[11px] leading-none text-neutral-500">{timeLabel}</p>
          ) : null}
          <div className="inline-block max-w-full rounded-xl bg-info-soft px-3 py-2 text-md text-foreground">
            <p className="whitespace-pre-line break-words">{message.content}</p>
          </div>
        </div>
      </li>
    )
  }

  return (
    <li className="flex justify-start">
      <div className="min-w-0 max-w-[82%]">
        <p className="mb-1 max-w-full truncate text-[0.85rem] leading-tight text-foreground">
          {toSenderLabel(message, currentUserId)}
        </p>
        <div className="flex items-end gap-1.5">
          <div className="inline-block max-w-full rounded-xl bg-neutral-300 px-3 py-2 text-md text-foreground">
            <p className="whitespace-pre-line break-words">{message.content}</p>
          </div>
          {timeLabel ? (
            <p className="shrink-0 text-[11px] leading-none text-neutral-500">{timeLabel}</p>
          ) : null}
        </div>
      </div>
    </li>
  )
}

export default function ChatRoomDetail() {
  const { roomId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()

  const [messages, setMessages] = useState([])
  const [nextCursor, setNextCursor] = useState(null)
  const [hasNextPage, setHasNextPage] = useState(false)

  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [realtimeError, setRealtimeError] = useState('')
  const [sendError, setSendError] = useState('')
  const [inputValue, setInputValue] = useState('')
  const [connectionStatus, setConnectionStatus] = useState('connecting')
  const [pendingCount, setPendingCount] = useState(0)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const [isLeaveDialogOpen, setIsLeaveDialogOpen] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)
  const [leaveError, setLeaveError] = useState('')
  const refreshUnreadChatStatus = useChatRealtimeStore((state) => state.refreshUnreadChatStatus)

  const currentUserId = useMemo(() => toCurrentUserId(), [])
  const connectionRef = useRef(null)
  const subscriptionRef = useRef(null)
  const connectionTokenRef = useRef(0)
  const pendingMessagesRef = useRef([])
  const flushTimeoutRef = useRef(null)
  const isFlushingRef = useRef(false)
  const messagesViewportRef = useRef(null)
  const previousMessageCountRef = useRef(0)

  const normalizedRoomId = useMemo(() => {
    const parsed = Number(roomId)

    if (!Number.isInteger(parsed) || parsed <= 0) {
      return null
    }

    return parsed
  }, [roomId])

  const titleFromState = location.state?.roomTitle
  const roomTitle = useMemo(() => {
    if (typeof titleFromState === 'string' && titleFromState.trim()) {
      return titleFromState.trim()
    }

    if (normalizedRoomId == null) {
      return '채팅방'
    }

    return `채팅방 #${normalizedRoomId}`
  }, [normalizedRoomId, titleFromState])

  const participantCount = useMemo(() => {
    const fromState = Number(location.state?.participantsCount ?? location.state?.participantCount)

    if (!Number.isInteger(fromState) || fromState <= 0) {
      return null
    }

    return fromState
  }, [location.state])

  const orderedMessages = useMemo(() => [...messages].reverse(), [messages])
  const messageRenderItems = useMemo(() => {
    const items = []
    let lastDateKey = null

    orderedMessages.forEach((message) => {
      const dateKey = toMessageDateKey(message)

      if (dateKey && dateKey !== lastDateKey) {
        items.push({
          key: `date-${dateKey}`,
          type: 'date',
          label: toMessageDateLabel(message),
        })
        lastDateKey = dateKey
      }

      items.push({
        key: message.messageId ?? `${message.type}-${message.createdAt}`,
        type: 'message',
        message,
      })
    })

    return items
  }, [orderedMessages])

  const clearFlushTimeout = useCallback(() => {
    if (flushTimeoutRef.current) {
      clearTimeout(flushTimeoutRef.current)
      flushTimeoutRef.current = null
    }
  }, [])

  const enqueuePendingMessage = useCallback((content, retriesLeft = 1) => {
    pendingMessagesRef.current.push({ content, retriesLeft })
    setPendingCount(pendingMessagesRef.current.length)
  }, [])

  const flushPendingMessages = useCallback(() => {
    const connection = connectionRef.current

    if (!connection || !connection.isConnected() || normalizedRoomId == null) {
      return
    }

    if (isFlushingRef.current) {
      return
    }

    isFlushingRef.current = true
    clearFlushTimeout()

    try {
      while (pendingMessagesRef.current.length > 0) {
        if (!connectionRef.current?.isConnected()) {
          break
        }

        const queued = pendingMessagesRef.current[0]

        try {
          connection.publishJson(toChatMessageSendDestination(normalizedRoomId), {
            content: queued.content,
          })
          pendingMessagesRef.current.shift()
          setPendingCount(pendingMessagesRef.current.length)
          setSendError('')
        } catch {
          if (queued.retriesLeft > 0) {
            queued.retriesLeft -= 1
            setSendError('메시지 전송을 재시도하고 있습니다.')
            flushTimeoutRef.current = setTimeout(() => {
              isFlushingRef.current = false
              flushPendingMessages()
            }, SEND_RETRY_DELAY_MS)
            return
          }

          pendingMessagesRef.current.shift()
          setPendingCount(pendingMessagesRef.current.length)
          setSendError('일부 메시지 전송에 실패했습니다. 다시 시도해주세요.')
        }
      }
    } finally {
      if (!flushTimeoutRef.current) {
        isFlushingRef.current = false
      }
    }
  }, [clearFlushTimeout, normalizedRoomId])

  const fetchMessages = useCallback(
    async ({ cursor = null, append = false } = {}) => {
      if (normalizedRoomId == null) {
        setLoadError('유효하지 않은 채팅방입니다.')
        setIsLoading(false)
        setIsLoadingMore(false)
        setMessages([])
        setHasNextPage(false)
        setNextCursor(null)
        return
      }

      if (append) {
        setIsLoadingMore(true)
      } else {
        setIsLoading(true)
      }
      setLoadError('')

      try {
        const response = await getChatRoomMessages({
          roomId: normalizedRoomId,
          cursor,
          limit: PAGE_LIMIT,
        })

        setMessages((previous) =>
          mergeMessages(append ? [...previous, ...response.items] : response.items),
        )
        setNextCursor(response.nextCursor)
        setHasNextPage(Boolean(response.hasNextPage))
      } catch (error) {
        const code = error?.response?.data?.code

        if (code === 'NO_CHAT_ROOM_PARTICIPANT') {
          navigate('/chat', {
            replace: true,
            state: { chatRedirectError: '참여 중인 채팅방이 아닙니다.' },
          })
          return
        }

        if (!append) {
          setMessages([])
          setHasNextPage(false)
          setNextCursor(null)
        }
        setLoadError(toMessageLoadError(error))
      } finally {
        setIsLoading(false)
        setIsLoadingMore(false)
      }
    },
    [navigate, normalizedRoomId],
  )

  useEffect(() => {
    fetchMessages()
  }, [fetchMessages])

  useEffect(() => {
    if (normalizedRoomId == null || isLoading) {
      return
    }

    const timer = window.setTimeout(() => {
      void refreshUnreadChatStatus()
    }, 120)

    return () => {
      window.clearTimeout(timer)
    }
  }, [isLoading, messages.length, normalizedRoomId, refreshUnreadChatStatus])

  useEffect(() => {
    if (normalizedRoomId == null) {
      setConnectionStatus('disconnected')
      return undefined
    }

    const connectionToken = connectionTokenRef.current + 1
    connectionTokenRef.current = connectionToken

    setRealtimeError('')
    setConnectionStatus('connecting')

    const connection = createChatStompConnection({
      onConnecting: () => {
        if (connectionTokenRef.current !== connectionToken) {
          return
        }

        setConnectionStatus((previous) =>
          previous === 'connected' ? 'reconnecting' : 'connecting',
        )
      },
      onConnect: () => {
        if (connectionTokenRef.current !== connectionToken) {
          return
        }

        setConnectionStatus('connected')
        setRealtimeError('')

        subscriptionRef.current?.unsubscribe()
        subscriptionRef.current = connectionRef.current?.subscribe(
          toChatRoomTopic(normalizedRoomId),
          (payload) => {
            if (!payload || typeof payload !== 'object') {
              return
            }

            const nextMessage = toChatMessageItem(payload)

            setMessages((previous) => mergeMessages([nextMessage, ...previous]))
          },
        )

        flushPendingMessages()
      },
      onStompError: () => {
        if (connectionTokenRef.current !== connectionToken) {
          return
        }

        setConnectionStatus('reconnecting')
        setRealtimeError('실시간 연결 오류가 발생했습니다. 자동 재연결 중입니다.')
      },
      onWebSocketClose: () => {
        if (connectionTokenRef.current !== connectionToken) {
          return
        }

        const shouldReconnect = connectionRef.current?.isActive()

        setConnectionStatus(shouldReconnect ? 'reconnecting' : 'disconnected')

        if (shouldReconnect) {
          setRealtimeError('실시간 연결이 끊어졌습니다. 자동 재연결 중입니다.')
        }
      },
      onWebSocketError: () => {
        if (connectionTokenRef.current !== connectionToken) {
          return
        }

        setConnectionStatus('reconnecting')
        setRealtimeError('실시간 연결 오류가 발생했습니다. 자동 재연결 중입니다.')
      },
    })

    connectionRef.current = connection
    connection.activate()

    return () => {
      connectionTokenRef.current += 1
      clearFlushTimeout()
      isFlushingRef.current = false

      subscriptionRef.current?.unsubscribe()
      subscriptionRef.current = null

      connectionRef.current = null
      connection.deactivate()

      pendingMessagesRef.current = []
      setPendingCount(0)
      setConnectionStatus('disconnected')
    }
  }, [clearFlushTimeout, flushPendingMessages, normalizedRoomId])

  const updateBottomState = useCallback(() => {
    const viewport = messagesViewportRef.current
    if (!viewport) {
      return
    }

    const remaining = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight
    setIsAtBottom(remaining < 32)
  }, [])

  const scrollToBottom = useCallback((behavior = 'auto') => {
    const viewport = messagesViewportRef.current
    if (!viewport) {
      return
    }

    viewport.scrollTo({ top: viewport.scrollHeight, behavior })
  }, [])

  useEffect(() => {
    const viewport = messagesViewportRef.current
    if (!viewport) {
      return
    }

    const handleScroll = () => updateBottomState()

    viewport.addEventListener('scroll', handleScroll, { passive: true })
    updateBottomState()

    return () => {
      viewport.removeEventListener('scroll', handleScroll)
    }
  }, [updateBottomState])

  useEffect(() => {
    const previousCount = previousMessageCountRef.current
    const currentCount = messages.length
    const increased = currentCount > previousCount

    previousMessageCountRef.current = currentCount

    if (!increased) {
      updateBottomState()
      return
    }

    if (previousCount === 0 || isAtBottom) {
      requestAnimationFrame(() => {
        scrollToBottom(previousCount === 0 ? 'auto' : 'smooth')
        updateBottomState()
      })
    }
  }, [isAtBottom, messages.length, scrollToBottom, updateBottomState])

  const handleLoadMore = () => {
    if (!hasNextPage || !nextCursor || isLoadingMore) {
      return
    }
    fetchMessages({ cursor: nextCursor, append: true })
  }

  const handleSubmit = (event) => {
    event.preventDefault()

    if (normalizedRoomId == null) {
      return
    }

    const content = inputValue.trim()
    if (!content) {
      return
    }

    if (content.length > MAX_INPUT_LENGTH) {
      setSendError(`메시지는 최대 ${MAX_INPUT_LENGTH}자까지 입력할 수 있습니다.`)
      return
    }

    const connection = connectionRef.current

    if (!connection || !connection.isConnected()) {
      enqueuePendingMessage(content)
      setInputValue('')
      setSendError('연결이 복구되면 자동으로 전송됩니다.')
      return
    }

    try {
      connection.publishJson(toChatMessageSendDestination(normalizedRoomId), { content })
      setInputValue('')
      setSendError('')
    } catch {
      enqueuePendingMessage(content)
      setInputValue('')
      setSendError('전송 실패로 자동 재시도를 예약했습니다.')
      flushPendingMessages()
    }
  }

  const handleLeaveClick = () => {
    setLeaveError('')
    setIsLeaveDialogOpen(true)
  }

  const handleLeaveCancel = () => {
    if (isLeaving) {
      return
    }

    setIsLeaveDialogOpen(false)
    setLeaveError('')
  }

  const handleLeaveConfirm = async () => {
    if (isLeaving || normalizedRoomId == null) {
      return
    }

    setLeaveError('')
    setIsLeaving(true)

    try {
      await leaveChatRoom({ roomId: normalizedRoomId })
      navigate('/chat', { replace: true })
    } catch (error) {
      const code = error?.response?.data?.code
      if (code === 'NO_CHAT_ROOM_PARTICIPANT') {
        navigate('/chat', { replace: true })
        return
      }
      setLeaveError(toLeaveErrorMessage(error))
    } finally {
      setIsLeaving(false)
    }
  }

  return (
    <Dialog
      open={isLeaveDialogOpen}
      onOpenChange={(nextOpen) => {
        if (isLeaving) {
          return
        }
        setIsLeaveDialogOpen(nextOpen)
        if (!nextOpen) {
          setLeaveError('')
        }
      }}
    >
      <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden px-4">
        <header className="shrink-0 border-b border-neutral-300 bg-background py-2.5">
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex flex-1 items-baseline gap-2">
              <h2 className="min-w-0 shrink truncate text-[1.3rem] font-semibold text-foreground">
                {roomTitle}
              </h2>
              <span className="shrink-0 text-[1.3rem] text-neutral-600">
                {participantCount ?? '-'}
              </span>
            </div>

            <div className="ml-auto flex shrink-0 items-center gap-3">
              <button
                aria-label="채팅방 나가기"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-foreground transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isLeaving}
                onClick={handleLeaveClick}
                type="button"
              >
                <LogOut className="h-6 w-6" />
              </button>
            </div>
          </div>
        </header>

        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-4 pt-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          ref={messagesViewportRef}
        >
          <p aria-live="polite" className="sr-only">
            연결 상태: {connectionStatus}
          </p>
          {loadError ? (
            <div className="pb-2">
              <StatusMessage tone="error">{loadError}</StatusMessage>
            </div>
          ) : null}
          {realtimeError ? (
            <div className="pb-2">
              <StatusMessage tone="muted">{realtimeError}</StatusMessage>
            </div>
          ) : null}

          {!isLoading && hasNextPage ? (
            <button
              className="mb-4 w-full rounded-md border border-neutral-300 bg-neutral-200 px-3 py-1.5 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-250 disabled:opacity-60"
              disabled={isLoadingMore}
              onClick={handleLoadMore}
              type="button"
            >
              {isLoadingMore ? '불러오는 중...' : '이전 메시지 더 보기'}
            </button>
          ) : null}

          {isLoading ? (
            <div className="space-y-5">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={`chat-message-skeleton-${index}`}
                  className={`h-16 w-[44%] animate-pulse bg-neutral-300 ${index % 2 ? 'ml-auto' : ''}`}
                />
              ))}
            </div>
          ) : null}

          {!isLoading && orderedMessages.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm font-semibold text-neutral-600">표시할 메시지가 없습니다.</p>
            </div>
          ) : null}

          {!isLoading && orderedMessages.length > 0 ? (
            <ul className="space-y-4">
              {messageRenderItems.map((item) => {
                if (item.type === 'date') {
                  return (
                    <li key={item.key} className="flex justify-center">
                      <div className="max-w-[85%] rounded-xl bg-neutral-300 px-3 py-2 text-[11px] text-neutral-700">
                        {item.label}
                      </div>
                    </li>
                  )
                }

                const { message } = item
                const isMine =
                  !SYSTEM_MESSAGE_TYPES.has(message.type) &&
                  currentUserId != null &&
                  Number(message.senderId) === currentUserId

                return (
                  <ChatMessageItem
                    key={item.key}
                    currentUserId={currentUserId}
                    isMine={isMine}
                    message={message}
                  />
                )
              })}
            </ul>
          ) : null}
        </div>

        {!isAtBottom && !isLoading && orderedMessages.length > 0 ? (
          <div className="pointer-events-none absolute bottom-[calc(var(--chatbot-input-bottom)+env(safe-area-inset-bottom)+5.5rem)] left-4 right-4 z-20">
            <div className="flex justify-end">
              <Button
                aria-label="최신 메시지로 이동"
                className="pointer-events-auto h-10 w-10 rounded-full border border-muted bg-background shadow-md"
                onClick={() => scrollToBottom('smooth')}
                size="icon"
                type="button"
                variant="outline"
              >
                <ArrowDown className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : null}

        <div className="shrink-0 bg-background/95 pb-[calc(var(--chatbot-input-bottom)+env(safe-area-inset-bottom))] pt-2 backdrop-blur">
          <p className="m-2 text-right text-[12px] text-neutral-500">
            {inputValue.length} / {MAX_INPUT_LENGTH}
          </p>
          <form
            className="flex items-end gap-2 rounded-2xl border border-muted-foreground/20 bg-background p-2 shadow-sm"
            onSubmit={handleSubmit}
          >
            <label className="sr-only" htmlFor="chat-room-message-input">
              메시지 입력
            </label>
            <Input
              id="chat-room-message-input"
              className="h-10 flex-1 border-0 px-2 text-[16px] placeholder:text-neutral-500 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
              maxLength={MAX_INPUT_LENGTH}
              onChange={(event) => {
                setInputValue(event.target.value)
                if (sendError) {
                  setSendError('')
                }
              }}
              placeholder="메시지를 입력하세요"
              value={inputValue}
            />
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
          </form>

          {pendingCount > 0 ? (
            <StatusMessage className="mt-2" tone="muted">
              대기 중인 메시지 {pendingCount}개가 연결 복구 후 자동 전송됩니다.
            </StatusMessage>
          ) : null}
          {sendError ? (
            <StatusMessage className="mt-2" tone="error">
              {sendError}
            </StatusMessage>
          ) : null}
        </div>
      </section>

      <DialogContent className="max-w-[320px] rounded-2xl border border-black/10 bg-white p-6 shadow-[0_20px_50px_rgba(15,23,42,0.18)]">
        <DialogHeader className="items-center text-center">
          <DialogTitle className="text-xl font-bold">채팅방 나가기</DialogTitle>
          <DialogDescription className="mt-3 text-sm text-muted-foreground">
            나가면 대화 내용을 더 이상 볼 수 없습니다.
            <br />
            계속 진행하시겠어요?
          </DialogDescription>
        </DialogHeader>

        {leaveError ? (
          <StatusMessage className="mt-4" tone="error">
            {leaveError}
          </StatusMessage>
        ) : null}

        <DialogFooter className="mt-5 flex-row items-center justify-center gap-3">
          <button
            className="min-w-[96px] rounded-md bg-foreground px-4 py-3 text-sm font-semibold text-background transition hover:opacity-90 disabled:opacity-50"
            disabled={isLeaving}
            onClick={handleLeaveCancel}
            type="button"
          >
            취소
          </button>
          <button
            className="min-w-[96px] rounded-md border border-black/60 px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-neutral-100 disabled:opacity-50"
            disabled={isLeaving}
            onClick={handleLeaveConfirm}
            type="button"
          >
            {isLeaving ? '처리 중...' : '나가기'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
