import { Lock, Plus, Search, Users, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import StatusMessage from '@/components/StatusMessage'
import { createChatRoom, getChatRoomList, joinChatRoom } from '@/services/chat/chatService'

const PAGE_LIMIT = 20
const MAX_TITLE_LENGTH = 100
const MIN_PASSWORD_LENGTH = 4
const MAX_PASSWORD_LENGTH = 72
const ASCII_PASSWORD_PATTERN = /^[\x20-\x7E]+$/

const SCOPE_OPTIONS = [
  { value: 'joined', label: '참여한 방' },
  { value: 'all', label: '전체 방' },
]

const getEmptyMessage = (scope, keyword) => {
  if (scope === 'all') {
    if (!keyword) {
      return '전체 오픈채팅방은 검색어를 입력하면 확인할 수 있습니다.'
    }
    return '검색 결과가 없습니다.'
  }

  if (keyword) {
    return '참여한 오픈채팅방 검색 결과가 없습니다.'
  }

  return '참여 중인 오픈채팅방이 없습니다.'
}

const toJoinErrorMessage = (error) => {
  const code = error?.response?.data?.code

  if (code === 'CHAT_ROOM_INVALID_PASSWORD') {
    return '비밀번호가 올바르지 않습니다.'
  }
  if (code === 'CHAT_ROOM_FULL') {
    return '정원이 가득 찬 오픈채팅방입니다.'
  }
  if (code === 'CHAT_ROOM_NOT_FOUND') {
    return '오픈채팅방을 찾을 수 없습니다.'
  }

  return '오픈채팅방 입장에 실패했습니다. 잠시 후 다시 시도해주세요.'
}

const toCreateErrorMessage = (error) => {
  const code = error?.response?.data?.code

  if (code === 'INVALID_INPUT') {
    return '입력값을 확인해주세요.'
  }

  return '오픈채팅방 생성에 실패했습니다. 잠시 후 다시 시도해주세요.'
}

const validateCreateForm = ({ title, password }) => {
  const normalizedTitle = title.trim()
  const normalizedPassword = password.trim()

  if (!normalizedTitle) {
    return '오픈채팅방 제목을 입력해주세요.'
  }

  if (normalizedTitle.length > MAX_TITLE_LENGTH) {
    return `오픈채팅방 제목은 최대 ${MAX_TITLE_LENGTH}자까지 입력할 수 있습니다.`
  }

  if (!normalizedPassword) {
    return ''
  }

  if (
    normalizedPassword.length < MIN_PASSWORD_LENGTH ||
    normalizedPassword.length > MAX_PASSWORD_LENGTH
  ) {
    return `비밀번호는 ${MIN_PASSWORD_LENGTH}~${MAX_PASSWORD_LENGTH}자로 입력해주세요.`
  }

  if (!ASCII_PASSWORD_PATTERN.test(normalizedPassword)) {
    return '비밀번호는 영문/숫자/특수문자(ASCII)만 사용할 수 있습니다.'
  }

  return ''
}

const JoinedChatRoomCard = ({ room, isOpening, onOpen }) => {
  const preview = room.lastMessagePreview?.trim() || '아직 메시지가 없습니다.'

  return (
    <li>
      <button
        className="w-full rounded-2xl border border-border bg-card p-4 text-left shadow-[0_6px_16px_rgba(15,23,42,0.05)] transition hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-70"
        disabled={isOpening}
        onClick={() => onOpen(room)}
        type="button"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{room.title}</p>
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{preview}</p>
          </div>
          {room.unreadCount > 0 ? (
            <span className="rounded-full bg-info px-2 py-0.5 text-[11px] font-semibold text-white">
              {room.unreadCount}
            </span>
          ) : null}
        </div>

        <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {room.participantsCount}명
          </span>
          <span>{isOpening ? '입장 중...' : room.lastMessageAtLabel || '메시지 없음'}</span>
        </div>
      </button>
    </li>
  )
}

const SearchChatRoomCard = ({ room, isOpening, onOpen }) => (
  <li>
    <button
      className="w-full rounded-2xl border border-border bg-card p-4 text-left shadow-[0_6px_16px_rgba(15,23,42,0.05)] transition hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-70"
      disabled={isOpening}
      onClick={() => onOpen(room)}
      type="button"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 flex-1 truncate text-sm font-semibold">{room.title}</p>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
            room.hasPassword ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
          }`}
        >
          {room.hasPassword ? <Lock className="h-3 w-3" /> : null}
          {room.hasPassword ? '비공개' : '공개'}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Users className="h-3.5 w-3.5" />
          {room.participantCount}/{room.maxParticipants}
        </span>
        <span>{isOpening ? '입장 중...' : room.lastMessageAtLabel || '메시지 없음'}</span>
      </div>
    </button>
  </li>
)

export default function ChatRooms() {
  const location = useLocation()
  const navigate = useNavigate()

  const [scope, setScope] = useState('joined')
  const [inputKeyword, setInputKeyword] = useState('')
  const [keyword, setKeyword] = useState('')

  const [rooms, setRooms] = useState([])
  const [nextCursor, setNextCursor] = useState(null)
  const [hasNextPage, setHasNextPage] = useState(false)

  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [joinError, setJoinError] = useState('')
  const [pendingRoomId, setPendingRoomId] = useState(null)

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [createTitle, setCreateTitle] = useState('')
  const [createPassword, setCreatePassword] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  useEffect(() => {
    const redirectedError = location.state?.chatRedirectError

    if (typeof redirectedError !== 'string' || !redirectedError.trim()) {
      return
    }

    setJoinError(redirectedError.trim())
    navigate('/chat', { replace: true, state: null })
  }, [location.state, navigate])

  const fetchRooms = useCallback(
    async ({ cursor = null, append = false } = {}) => {
      if (scope === 'all' && !keyword) {
        setRooms([])
        setNextCursor(null)
        setHasNextPage(false)
        setLoadError('')
        setIsLoading(false)
        setIsLoadingMore(false)
        return
      }

      if (append) {
        setIsLoadingMore(true)
      } else {
        setIsLoading(true)
      }
      setLoadError('')
      setJoinError('')

      try {
        const response = await getChatRoomList({
          scope,
          keyword,
          cursor,
          limit: PAGE_LIMIT,
        })

        setRooms((previous) => (append ? [...previous, ...response.items] : response.items))
        setNextCursor(response.nextCursor)
        setHasNextPage(Boolean(response.hasNextPage))
      } catch {
        if (!append) {
          setRooms([])
          setNextCursor(null)
          setHasNextPage(false)
        }
        setLoadError('오픈채팅방 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.')
      } finally {
        setIsLoading(false)
        setIsLoadingMore(false)
      }
    },
    [keyword, scope],
  )

  useEffect(() => {
    fetchRooms()
  }, [fetchRooms])

  const handleSearchSubmit = (event) => {
    event.preventDefault()
    setKeyword(inputKeyword.trim())
  }

  const handleLoadMore = () => {
    if (!hasNextPage || !nextCursor || isLoadingMore) {
      return
    }
    fetchRooms({ cursor: nextCursor, append: true })
  }

  const toggleCreateForm = () => {
    setIsCreateOpen((previous) => !previous)
    setCreateError('')
  }

  const handleCreateSubmit = async (event) => {
    event.preventDefault()

    if (isCreating) {
      return
    }

    const validationMessage = validateCreateForm({
      title: createTitle,
      password: createPassword,
    })

    if (validationMessage) {
      setCreateError(validationMessage)
      return
    }

    setCreateError('')
    setIsCreating(true)

    try {
      const { roomId } = await createChatRoom({
        title: createTitle.trim(),
        password: createPassword.trim() || undefined,
      })

      navigate(`/chat/${roomId}`, {
        state: { roomTitle: createTitle.trim() },
      })
    } catch (error) {
      setCreateError(toCreateErrorMessage(error))
    } finally {
      setIsCreating(false)
    }
  }

  const handleOpenRoom = async (room) => {
    const roomId = Number(room.roomId)

    if (!Number.isInteger(roomId) || roomId <= 0) {
      setJoinError('유효하지 않은 오픈채팅방입니다.')
      return
    }

    if (pendingRoomId === roomId) {
      return
    }

    setJoinError('')

    if (scope === 'joined') {
      navigate(`/chat/${roomId}`, { state: { roomTitle: room.title } })
      return
    }

    let password
    if (room.hasPassword) {
      const entered = window.prompt('비밀번호를 입력해주세요.')
      if (entered === null) {
        return
      }
      password = entered.trim()
      if (!password) {
        setJoinError('비밀번호를 입력해주세요.')
        return
      }
    }

    setPendingRoomId(roomId)

    try {
      await joinChatRoom({ roomId, password })
      navigate(`/chat/${roomId}`, { state: { roomTitle: room.title } })
    } catch (error) {
      const code = error?.response?.data?.code
      if (code === 'CHAT_ROOM_ALREADY_JOINED') {
        navigate(`/chat/${roomId}`, { state: { roomTitle: room.title } })
        return
      }
      setJoinError(toJoinErrorMessage(error))
    } finally {
      setPendingRoomId(null)
    }
  }

  const emptyMessage = useMemo(() => getEmptyMessage(scope, keyword), [scope, keyword])

  return (
    <section className="space-y-4">
      <div className="min-h-9">
        <h2 className="text-lg font-semibold">오픈채팅</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          참여한 오픈채팅방을 확인하고, 원하는 방을 검색해보세요.
        </p>
      </div>

      <div className="flex items-center justify-end">
        <button
          className="inline-flex h-9 items-center gap-1 rounded-lg border border-border bg-background px-3 text-xs font-semibold transition hover:bg-muted/40"
          onClick={toggleCreateForm}
          type="button"
        >
          {isCreateOpen ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {isCreateOpen ? '생성 닫기' : '방 만들기'}
        </button>
      </div>

      {isCreateOpen ? (
        <div className="rounded-2xl border border-border bg-card p-3">
          <form className="space-y-3" onSubmit={handleCreateSubmit}>
            <div className="space-y-1">
              <label className="text-xs font-semibold" htmlFor="create-chat-room-title">
                오픈채팅방 제목
              </label>
              <input
                id="create-chat-room-title"
                className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none transition focus:border-info"
                maxLength={MAX_TITLE_LENGTH}
                onChange={(event) => setCreateTitle(event.target.value)}
                placeholder="예) 백준 실버 문제 풀이방"
                value={createTitle}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold" htmlFor="create-chat-room-password">
                비밀번호 (선택)
              </label>
              <input
                id="create-chat-room-password"
                className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none transition focus:border-info"
                maxLength={MAX_PASSWORD_LENGTH}
                onChange={(event) => setCreatePassword(event.target.value)}
                placeholder="비워두면 공개방으로 생성됩니다"
                value={createPassword}
              />
              <p className="text-[11px] text-muted-foreground">
                비밀번호를 입력하면 비공개 오픈채팅방으로 생성됩니다.
              </p>
            </div>

            <button
              className="h-10 w-full rounded-xl bg-info text-sm font-semibold text-white transition hover:bg-info/90 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isCreating}
              type="submit"
            >
              {isCreating ? '생성 중...' : '오픈채팅방 생성'}
            </button>
          </form>
        </div>
      ) : null}

      {createError ? <StatusMessage tone="error">{createError}</StatusMessage> : null}

      <div className="rounded-2xl border border-border bg-card p-3">
        <form className="flex items-center gap-2" onSubmit={handleSearchSubmit}>
          <label className="relative flex-1" htmlFor="chat-room-keyword">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              id="chat-room-keyword"
              className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm outline-none transition focus:border-info"
              maxLength={100}
              onChange={(event) => setInputKeyword(event.target.value)}
              placeholder="오픈채팅방 제목 검색"
              value={inputKeyword}
            />
          </label>
          <button
            className="h-10 shrink-0 rounded-xl bg-info px-4 text-sm font-semibold text-white transition hover:bg-info/90"
            type="submit"
          >
            검색
          </button>
        </form>

        <div className="mt-3 grid grid-cols-2 gap-2">
          {SCOPE_OPTIONS.map((option) => {
            const isActive = scope === option.value

            return (
              <button
                key={option.value}
                className={`h-9 rounded-lg border text-xs font-semibold transition ${
                  isActive
                    ? 'border-info bg-info-soft text-info'
                    : 'border-border bg-background text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => setScope(option.value)}
                type="button"
              >
                {option.label}
              </button>
            )
          })}
        </div>
      </div>

      {scope === 'all' && !keyword ? (
        <StatusMessage>전체 오픈채팅방은 검색어를 입력해야 조회할 수 있습니다.</StatusMessage>
      ) : null}

      {loadError ? <StatusMessage tone="error">{loadError}</StatusMessage> : null}
      {joinError ? <StatusMessage tone="error">{joinError}</StatusMessage> : null}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={`chat-room-skeleton-${index}`}
              className="h-24 animate-pulse rounded-2xl bg-muted/60"
            />
          ))}
        </div>
      ) : null}

      {!isLoading && rooms.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center">
          <p className="text-sm font-semibold">{emptyMessage}</p>
        </div>
      ) : null}

      {!isLoading && rooms.length > 0 ? (
        <ul className="space-y-2">
          {rooms.map((room) => {
            const roomId = Number(room.roomId)
            const isOpening = Number.isInteger(roomId) && pendingRoomId === roomId

            return scope === 'joined' ? (
              <JoinedChatRoomCard
                key={room.roomId}
                isOpening={isOpening}
                onOpen={handleOpenRoom}
                room={room}
              />
            ) : (
              <SearchChatRoomCard
                key={room.roomId}
                isOpening={isOpening}
                onOpen={handleOpenRoom}
                room={room}
              />
            )
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
          {isLoadingMore ? '불러오는 중...' : '더 보기'}
        </button>
      ) : null}
    </section>
  )
}
