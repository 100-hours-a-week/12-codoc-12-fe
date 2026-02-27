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

  if (code === 'NO_CHAT_ROOM_PARTICIPANT') {
    return '참여 중인 오픈채팅방이 아닙니다. 목록에서 입장해주세요.'
  }
  if (code === 'CHAT_ROOM_NOT_FOUND') {
    return '오픈채팅방을 찾을 수 없습니다.'
  }

  return '메시지를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.'
}

const SYSTEM_MESSAGE_TYPES = new Set(['SYSTEM', 'INIT'])

const mergeMessages = (items = []) => {
  const seen = new Set()

  return items.filter((item) => {
    if (item.messageId == null) {
      return true
    }

    if (seen.has(item.messageId)) {
      return false
    }

    seen.add(item.messageId)
    return true
  })
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

  const currentUserId = useMemo(() => toCurrentUserId(), [])
  const connectionRef = useRef(null)
  const subscriptionRef = useRef(null)

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
    [normalizedRoomId],
  )

  useEffect(() => {
    fetchMessages()
  }, [fetchMessages])

  useEffect(() => {
    if (normalizedRoomId == null) {
      return undefined
    }

    const connection = createChatStompConnection({
      onConnect: () => {
        setRealtimeError('')

        subscriptionRef.current?.unsubscribe()
        subscriptionRef.current = connectionRef.current?.subscribe(
          toChatRoomTopic(normalizedRoomId),
          (payload) => {
            if (!payload || typeof payload !== 'object') {
              return
            }

            const nextMessage = toChatMessageItem(payload)

            setMessages((previous) => {
              const merged = [nextMessage, ...previous]
              return mergeMessages(merged)
            })
          },
        )
      },
      onStompError: () => {
        setRealtimeError('실시간 연결 오류가 발생했습니다. 자동 재연결 중입니다.')
      },
      onWebSocketClose: () => {
        setRealtimeError('실시간 연결이 끊어졌습니다. 자동 재연결 중입니다.')
      },
      onWebSocketError: () => {
        setRealtimeError('실시간 연결 오류가 발생했습니다. 자동 재연결 중입니다.')
      },
    })

    connectionRef.current = connection
    connection.activate()

    return () => {
      subscriptionRef.current?.unsubscribe()
      subscriptionRef.current = null
      connectionRef.current = null
      connection.deactivate()
    }
  }, [normalizedRoomId])

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
      setSendError('실시간 연결을 준비 중입니다. 잠시 후 다시 시도해주세요.')
      return
    }

    try {
      connection.publishJson(toChatMessageSendDestination(normalizedRoomId), { content })
      setInputValue('')
      setSendError('')
    } catch {
      setSendError('메시지 전송에 실패했습니다. 잠시 후 다시 시도해주세요.')
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

        <h2 className="mt-2 text-base font-semibold">{roomTitle}</h2>
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

        {sendError ? (
          <StatusMessage tone="error" className="mt-2">
            {sendError}
          </StatusMessage>
        ) : null}
      </form>
    </section>
  )
}
