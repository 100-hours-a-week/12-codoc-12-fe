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
const TOP_LOAD_THRESHOLD_PX = 72
const LOAD_MORE_COOLDOWN_MS = 420

const toIsNetworkOnline = () => {
  if (typeof navigator === 'undefined') {
    return true
  }

  return navigator.onLine !== false
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
  const byClientMessageId = new Map()
  const withoutId = []

  items.forEach((item) => {
    if (item?.messageId == null) {
      if (
        typeof item?.clientMessageId === 'string' &&
        item.clientMessageId.trim() &&
        !byClientMessageId.has(item.clientMessageId)
      ) {
        byClientMessageId.set(item.clientMessageId, item)
        return
      }

      withoutId.push(item)
      return
    }

    if (!byId.has(item.messageId)) {
      byId.set(item.messageId, item)
    }
  })

  return [...byId.values(), ...byClientMessageId.values(), ...withoutId].sort(compareMessagesDesc)
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

const toSenderAvatarImageUrl = (message) => {
  if (typeof message?.senderAvatarImageUrl !== 'string') {
    return ''
  }

  return message.senderAvatarImageUrl.trim()
}

const toSenderAvatarFallbackText = (message, currentUserId) => {
  const senderLabel = toSenderLabel(message, currentUserId)
  return senderLabel ? senderLabel.slice(0, 1) : '?'
}

function ChatMessageItem({ currentUserId, isMine, message }) {
  const isSystemMessage = SYSTEM_MESSAGE_TYPES.has(message.type)
  const timeLabel = toMessageTimeLabel(message)
  const senderLabel = toSenderLabel(message, currentUserId)
  const avatarImageUrl = toSenderAvatarImageUrl(message)
  const [isAvatarImageError, setIsAvatarImageError] = useState(false)

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
      <div className="flex max-w-[88%] items-start gap-2">
        <div className="mt-0.5 h-8 w-8 shrink-0 overflow-hidden rounded-full bg-neutral-200">
          {avatarImageUrl && !isAvatarImageError ? (
            <img
              alt={`${senderLabel} 프로필 이미지`}
              className="h-full w-full object-cover"
              onError={() => setIsAvatarImageError(true)}
              src={avatarImageUrl}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-neutral-700">
              {toSenderAvatarFallbackText(message, currentUserId)}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="mb-1 max-w-full truncate text-[0.85rem] leading-tight text-foreground">
            {senderLabel}
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
  const [inputValue, setInputValue] = useState('')
  const [isInputFocused, setIsInputFocused] = useState(false)
  const [isNetworkOnline, setIsNetworkOnline] = useState(() => toIsNetworkOnline())
  const [connectionStatus, setConnectionStatus] = useState('connecting')
  const [keyboardOffset, setKeyboardOffset] = useState(0)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const [isLeaveDialogOpen, setIsLeaveDialogOpen] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)
  const [leaveError, setLeaveError] = useState('')
  const refreshUnreadChatStatus = useChatRealtimeStore((state) => state.refreshUnreadChatStatus)

  const currentUserId = useMemo(() => toCurrentUserId(), [])
  const connectionRef = useRef(null)
  const subscriptionRef = useRef(null)
  const connectionTokenRef = useRef(0)
  const isNetworkOnlineRef = useRef(toIsNetworkOnline())
  const messagesViewportRef = useRef(null)
  const messageInputRef = useRef(null)
  const previousMessageCountRef = useRef(0)
  const prependScrollRestoreRef = useRef(null)
  const lastLoadMoreAtRef = useRef(0)

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow
    const previousHtmlOverflow = document.documentElement.style.overflow
    const previousBodyOverscrollBehaviorY = document.body.style.overscrollBehaviorY
    const previousHtmlOverscrollBehaviorY = document.documentElement.style.overscrollBehaviorY

    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overscrollBehaviorY = 'none'
    document.documentElement.style.overscrollBehaviorY = 'none'

    return () => {
      document.body.style.overflow = previousBodyOverflow
      document.documentElement.style.overflow = previousHtmlOverflow
      document.body.style.overscrollBehaviorY = previousBodyOverscrollBehaviorY
      document.documentElement.style.overscrollBehaviorY = previousHtmlOverscrollBehaviorY
    }
  }, [])

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
  const inputBottomOffset = useMemo(
    () => `calc(var(--chatbot-input-bottom) + env(safe-area-inset-bottom) + ${keyboardOffset}px)`,
    [keyboardOffset],
  )
  const scrollToBottomButtonOffset = useMemo(
    () => `calc(${inputBottomOffset} + 5.5rem)`,
    [inputBottomOffset],
  )

  const orderedMessages = useMemo(() => [...messages].reverse(), [messages])
  const shouldShowScrollDownButton =
    !isAtBottom &&
    !isLoading &&
    orderedMessages.length > 0 &&
    !isInputFocused &&
    keyboardOffset <= 0
  const canSend = useMemo(
    () => inputValue.trim().length > 0 && isNetworkOnline && connectionStatus === 'connected',
    [connectionStatus, inputValue, isNetworkOnline],
  )
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
        key: message.clientMessageId ?? message.messageId ?? `${message.type}-${message.createdAt}`,
        type: 'message',
        message,
      })
    })

    return items
  }, [orderedMessages])

  useEffect(() => {
    const handleOnline = () => {
      isNetworkOnlineRef.current = true
      setIsNetworkOnline(true)
    }

    const handleOffline = () => {
      isNetworkOnlineRef.current = false
      setIsNetworkOnline(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

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
          mergeMessages(append ? [...previous, ...response.items] : [...response.items]),
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
      },
      onStompError: () => {
        if (connectionTokenRef.current !== connectionToken) {
          return
        }

        setConnectionStatus('reconnecting')
      },
      onWebSocketClose: () => {
        if (connectionTokenRef.current !== connectionToken) {
          return
        }

        const shouldReconnect = connectionRef.current?.isActive()

        setConnectionStatus(shouldReconnect ? 'reconnecting' : 'disconnected')
      },
      onWebSocketError: () => {
        if (connectionTokenRef.current !== connectionToken) {
          return
        }

        setConnectionStatus('reconnecting')
      },
    })

    connectionRef.current = connection
    connection.activate()

    return () => {
      connectionTokenRef.current += 1

      subscriptionRef.current?.unsubscribe()
      subscriptionRef.current = null

      connectionRef.current = null
      connection.deactivate()

      setConnectionStatus('disconnected')
    }
  }, [normalizedRoomId])

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

  const handleLoadMore = useCallback(() => {
    const viewport = messagesViewportRef.current
    if (!viewport || !hasNextPage || !nextCursor || isLoadingMore || isLoading) {
      return
    }

    const now = Date.now()
    if (now - lastLoadMoreAtRef.current < LOAD_MORE_COOLDOWN_MS) {
      return
    }

    lastLoadMoreAtRef.current = now
    prependScrollRestoreRef.current = {
      scrollTop: viewport.scrollTop,
      scrollHeight: viewport.scrollHeight,
    }

    fetchMessages({ cursor: nextCursor, append: true })
  }, [fetchMessages, hasNextPage, isLoading, isLoadingMore, nextCursor])

  useEffect(() => {
    const viewport = messagesViewportRef.current
    if (!viewport) {
      return
    }

    const handleScroll = () => {
      updateBottomState()

      if (viewport.scrollTop <= TOP_LOAD_THRESHOLD_PX) {
        handleLoadMore()
      }
    }

    viewport.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()

    return () => {
      viewport.removeEventListener('scroll', handleScroll)
    }
  }, [handleLoadMore, updateBottomState])

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

  useEffect(() => {
    const restore = prependScrollRestoreRef.current
    const viewport = messagesViewportRef.current
    if (!restore || !viewport) {
      return
    }

    const nextScrollTop = restore.scrollTop + (viewport.scrollHeight - restore.scrollHeight)
    viewport.scrollTop = Math.max(0, nextScrollTop)
    prependScrollRestoreRef.current = null
  }, [messages.length])

  useEffect(() => {
    if (keyboardOffset <= 0) {
      return
    }

    requestAnimationFrame(() => {
      scrollToBottom('auto')
      updateBottomState()
    })
  }, [keyboardOffset, scrollToBottom, updateBottomState])

  const focusMessageInput = () => {
    requestAnimationFrame(() => {
      messageInputRef.current?.focus({ preventScroll: true })
    })
  }

  useEffect(() => {
    const inputEl = messageInputRef.current
    if (!inputEl) {
      return
    }

    inputEl.style.height = '0px'
    const nextHeight = Math.min(inputEl.scrollHeight, 120)
    inputEl.style.height = `${nextHeight}px`
    inputEl.style.overflowY = inputEl.scrollHeight > 120 ? 'auto' : 'hidden'
  }, [inputValue])

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
      return
    }

    const connection = connectionRef.current
    const isSendBlocked = !isNetworkOnline || !connection || !connection.isConnected()
    if (isSendBlocked) {
      return
    }

    try {
      connection.publishJson(toChatMessageSendDestination(normalizedRoomId), { content })
      setInputValue('')
      focusMessageInput()
    } catch {
      return
    }
  }

  const handleMessageInputKeyDown = (event) => {
    if (event.key !== 'Enter') {
      return
    }

    if (event.nativeEvent?.isComposing) {
      return
    }

    if (event.shiftKey) {
      return
    }

    event.preventDefault()
    event.currentTarget.form?.requestSubmit()
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
        if (nextOpen) {
          setIsLeaveDialogOpen(true)
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
            연결 상태: {isNetworkOnline ? connectionStatus : 'offline'}
          </p>
          {loadError ? (
            <div className="pb-2">
              <StatusMessage tone="error">{loadError}</StatusMessage>
            </div>
          ) : null}

          {!isLoading && isLoadingMore ? (
            <div className="pb-3 text-center text-xs font-semibold text-neutral-500">
              이전 메시지를 불러오는 중...
            </div>
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

        {shouldShowScrollDownButton ? (
          <div
            className="pointer-events-none absolute left-4 right-4 z-20"
            style={{ bottom: scrollToBottomButtonOffset }}
          >
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

        <div
          className="shrink-0 bg-background/95 pt-2 backdrop-blur"
          style={{ paddingBottom: inputBottomOffset }}
        >
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
            <textarea
              id="chat-room-message-input"
              className="min-h-10 max-h-[120px] flex-1 resize-none border-0 px-2 py-2 text-[16px] leading-6 placeholder:text-muted-foreground/40 shadow-none focus-visible:outline-none"
              maxLength={MAX_INPUT_LENGTH}
              ref={messageInputRef}
              onChange={(event) => setInputValue(event.target.value)}
              onKeyDown={handleMessageInputKeyDown}
              onFocus={() => setIsInputFocused(true)}
              onBlur={() => setIsInputFocused(false)}
              placeholder="메시지를 입력하세요"
              rows={1}
              value={inputValue}
            />
            <Button
              className={`h-10 rounded-xl ${canSend ? 'bg-info text-white hover:bg-info/90' : ''}`}
              disabled={!canSend}
              onPointerDown={(event) => event.preventDefault()}
              size="sm"
              type="submit"
              variant="secondary"
            >
              <Send className="h-4 w-4" />
              전송
            </Button>
          </form>
        </div>
      </section>

      <DialogContent
        className="p-6"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        <div className="flex flex-col gap-5">
          <DialogHeader className="space-y-2 text-left">
            <DialogTitle>채팅방 나가기</DialogTitle>
            <DialogDescription>
              나가면 대화 내용을 더 이상 볼 수 없습니다.
              <br />
              계속 진행하시겠어요?
            </DialogDescription>
          </DialogHeader>

          {leaveError ? <StatusMessage tone="error">{leaveError}</StatusMessage> : null}

          <DialogFooter className="flex-row justify-end gap-2">
            <Button
              disabled={isLeaving}
              onClick={handleLeaveCancel}
              type="button"
              variant="outline"
            >
              취소
            </Button>
            <Button disabled={isLeaving} onClick={handleLeaveConfirm} type="button">
              {isLeaving ? '처리 중...' : '나가기'}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
