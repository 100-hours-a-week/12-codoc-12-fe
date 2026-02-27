import { ChevronLeft, SendHorizontal } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'

import StatusMessage from '@/components/StatusMessage'
import { getAccessTokenPayload } from '@/lib/auth'
import { toChatMessageItem } from '@/services/chat/chatDto'
import {
  createChatStompConnection,
  toChatMessageSendDestination,
  toChatRoomTopic,
} from '@/services/chat/chatRealtime'
import { getChatRoomMessages } from '@/services/chat/chatService'

const PAGE_LIMIT = 30
const MAX_INPUT_LENGTH = 500
const SEND_RETRY_DELAY_MS = 700

const CONNECTION_STATUS_META = {
  connecting: { label: '연결 중', className: 'bg-muted text-muted-foreground' },
  connected: { label: '연결됨', className: 'bg-emerald-100 text-emerald-700' },
  reconnecting: { label: '재연결 중', className: 'bg-amber-100 text-amber-700' },
  disconnected: { label: '연결 종료', className: 'bg-red-100 text-red-600' },
}

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
    return '오픈채팅방을 찾을 수 없습니다.'
  }

  return '메시지를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.'
}

const SYSTEM_MESSAGE_TYPES = new Set(['SYSTEM', 'INIT'])

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

function ChatMessageItem({ isMine, message }) {
  const isSystemMessage = SYSTEM_MESSAGE_TYPES.has(message.type)

  if (isSystemMessage) {
    return (
      <li className="flex justify-center">
        <div className="max-w-[88%] rounded-full bg-muted px-3 py-1.5 text-[11px] text-muted-foreground">
          {message.content}
        </div>
      </li>
    )
  }

  return (
    <li className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[82%] ${isMine ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        <div
          className={`rounded-2xl px-3 py-2.5 text-sm leading-6 ${
            isMine ? 'bg-info-soft text-foreground' : 'bg-muted text-foreground'
          }`}
        >
          <p className="whitespace-pre-line">{message.content}</p>
        </div>
        <span className="text-[10px] text-muted-foreground">{message.createdAtLabel}</span>
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

  const currentUserId = useMemo(() => toCurrentUserId(), [])
  const connectionRef = useRef(null)
  const subscriptionRef = useRef(null)
  const connectionTokenRef = useRef(0)
  const pendingMessagesRef = useRef([])
  const flushTimeoutRef = useRef(null)
  const isFlushingRef = useRef(false)

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
      return '오픈채팅방'
    }

    return `오픈채팅방 #${normalizedRoomId}`
  }, [normalizedRoomId, titleFromState])

  const statusMeta = CONNECTION_STATUS_META[connectionStatus] ?? CONNECTION_STATUS_META.connecting

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
        setLoadError('유효하지 않은 오픈채팅방입니다.')
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
            state: { chatRedirectError: '참여 중인 오픈채팅방이 아닙니다.' },
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

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-3">
        <button
          className="inline-flex items-center gap-1 rounded-lg px-1 py-1 text-xs font-semibold text-muted-foreground transition hover:text-foreground"
          onClick={() => navigate('/chat')}
          type="button"
        >
          <ChevronLeft className="h-4 w-4" />
          오픈채팅 목록으로
        </button>

        <div className="mt-2 flex items-center justify-between gap-2">
          <h2 className="min-w-0 truncate text-base font-semibold">{roomTitle}</h2>
          <span
            className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold ${statusMeta.className}`}
          >
            {statusMeta.label}
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">최신 메시지 순으로 표시됩니다.</p>
      </div>

      {loadError ? <StatusMessage tone="error">{loadError}</StatusMessage> : null}
      {realtimeError ? <StatusMessage tone="muted">{realtimeError}</StatusMessage> : null}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={`chat-message-skeleton-${index}`}
              className="h-14 animate-pulse rounded-2xl bg-muted/60"
            />
          ))}
        </div>
      ) : null}

      {!isLoading && messages.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center">
          <p className="text-sm font-semibold">표시할 메시지가 없습니다.</p>
        </div>
      ) : null}

      {!isLoading && messages.length > 0 ? (
        <ul className="space-y-2">
          {messages.map((message) => {
            const key = message.messageId ?? `${message.type}-${message.createdAt}`
            const isMine =
              !SYSTEM_MESSAGE_TYPES.has(message.type) &&
              currentUserId != null &&
              message.senderId === currentUserId

            return <ChatMessageItem key={key} isMine={isMine} message={message} />
          })}
        </ul>
      ) : null}

      {!isLoading && hasNextPage ? (
        <button
          className="w-full rounded-xl border border-border bg-background px-4 py-2 text-sm font-semibold transition hover:bg-muted/40 disabled:opacity-60"
          disabled={isLoadingMore}
          onClick={handleLoadMore}
          type="button"
        >
          {isLoadingMore ? '불러오는 중...' : '이전 메시지 더 보기'}
        </button>
      ) : null}

      <form className="rounded-2xl border border-border bg-card p-3" onSubmit={handleSubmit}>
        <label className="sr-only" htmlFor="chat-room-message-input">
          메시지 입력
        </label>
        <textarea
          id="chat-room-message-input"
          className="min-h-20 w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-info"
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

        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="text-[11px] text-muted-foreground">
            {inputValue.length}/{MAX_INPUT_LENGTH}
          </span>

          <button
            className="inline-flex h-9 items-center gap-1 rounded-xl bg-info px-3 text-xs font-semibold text-white transition hover:bg-info/90 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!inputValue.trim()}
            type="submit"
          >
            <SendHorizontal className="h-4 w-4" />
            전송
          </button>
        </div>

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
      </form>
    </section>
  )
}
