import { Lock, Plus, Search, Users } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import StatusMessage from '@/components/StatusMessage'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { createChatRoom, getChatRoomList, joinChatRoom } from '@/services/chat/chatService'
import { useChatRealtimeStore } from '@/stores/useChatRealtimeStore'

const PAGE_LIMIT = 20
const MAX_TITLE_LENGTH = 100
const MIN_PASSWORD_LENGTH = 4
const MAX_PASSWORD_LENGTH = 72
const ASCII_PASSWORD_PATTERN = /^[\x20-\x7E]+$/

const SCOPE_OPTIONS = [
  { value: 'joined', label: '내 채팅' },
  { value: 'all', label: '전체' },
]

const normalizeChatRoomLabel = (value = '') =>
  String(value).replaceAll('오픈채팅방', '채팅방').replaceAll('오픈채팅', '채팅')

const getEmptyMessage = (scope, keyword) => {
  if (scope === 'all') {
    return keyword ? '검색 결과가 없습니다.' : '등록된 전체 채팅방이 없습니다.'
  }

  if (keyword) {
    return '참여한 채팅방 검색 결과가 없습니다.'
  }

  return '참여 중인 채팅방이 없습니다.'
}

const toJoinErrorMessage = (error) => {
  const code = error?.response?.data?.code

  if (code === 'CHAT_ROOM_INVALID_PASSWORD') {
    return '비밀번호가 올바르지 않습니다.'
  }
  if (code === 'CHAT_ROOM_FULL') {
    return '정원이 가득 찬 채팅방입니다.'
  }
  if (code === 'CHAT_ROOM_NOT_FOUND') {
    return '채팅방을 찾을 수 없습니다.'
  }

  return '채팅방 입장에 실패했습니다. 잠시 후 다시 시도해주세요.'
}

const toCreateErrorMessage = (error) => {
  const code = error?.response?.data?.code

  if (code === 'INVALID_INPUT') {
    return '입력값을 확인해주세요.'
  }

  return '채팅방 생성에 실패했습니다. 잠시 후 다시 시도해주세요.'
}

const validateCreateForm = ({ title, password }) => {
  const normalizedTitle = title.trim()
  const normalizedPassword = password.trim()

  if (!normalizedTitle) {
    return '채팅방 제목을 입력해주세요.'
  }

  if (normalizedTitle.length > MAX_TITLE_LENGTH) {
    return `채팅방 제목은 최대 ${MAX_TITLE_LENGTH}자까지 입력할 수 있습니다.`
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
        className="block w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 disabled:cursor-not-allowed disabled:opacity-70"
        disabled={isOpening}
        onClick={() => onOpen(room)}
        type="button"
      >
        <Card className="border-muted/60 bg-muted/70 shadow-sm transition hover:shadow-md">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {room.hasPassword ? (
                    <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  ) : null}
                  <div className="min-w-0 flex shrink items-baseline gap-2">
                    <h3 className="min-w-0 shrink truncate text-[1.05rem] font-semibold text-foreground">
                      {room.title}
                    </h3>
                    <span className="shrink-0 text-[1.00rem] text-neutral-600">
                      {room.participantsCount}
                    </span>
                  </div>
                </div>

                <p className="mt-1 line-clamp-2 text-sm text-neutral-600">
                  {isOpening ? '입장 중...' : preview}
                </p>
              </div>

              <div className="flex w-16 shrink-0 flex-col items-end gap-2">
                <span className="shrink-0 text-[11px] text-neutral-600">
                  {room.lastMessageAtLabel || '메시지 없음'}
                </span>
                {room.unreadCount > 0 ? (
                  <Badge className="shrink-0 rounded-full bg-red-500 px-2.5 py-0.5 text-sm text-white">
                    {room.unreadCount >= 1000 ? '999+' : room.unreadCount}
                  </Badge>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>
      </button>
    </li>
  )
}

const SearchChatRoomCard = ({ room, isOpening, onOpen }) => (
  <li>
    <button
      className="block w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 disabled:cursor-not-allowed disabled:opacity-70"
      disabled={isOpening}
      onClick={() => onOpen(room)}
      type="button"
    >
      <Card className="border-muted/60 bg-muted/70 shadow-sm transition hover:shadow-md">
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            {room.hasPassword ? <Lock className="h-4 w-4 shrink-0 text-muted-foreground" /> : null}
            <h3 className="min-w-0 flex-1 truncate text-base font-semibold text-foreground">
              {room.title}
            </h3>
            {room.isJoined ? (
              <Badge className="rounded-full border border-info/30 bg-info/10 px-2.5 py-0.5 text-[11px] font-semibold text-info">
                참가중
              </Badge>
            ) : null}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-semibold text-muted-foreground">
            <Badge className="rounded-full bg-background px-3 py-1 text-foreground/80">
              <span className="inline-flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {room.participantCount}/{room.maxParticipants}
              </span>
            </Badge>
            <Badge className="rounded-full bg-background px-3 py-1 text-foreground/80">
              {room.lastMessageAtLabel || '메시지 없음'}
            </Badge>
          </div>
        </CardContent>
      </Card>
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
  const [joinedRoomIds, setJoinedRoomIds] = useState(() => new Set())
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
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false)
  const [passwordInput, setPasswordInput] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordRoom, setPasswordRoom] = useState(null)
  const [isPublicJoinDialogOpen, setIsPublicJoinDialogOpen] = useState(false)
  const [publicJoinRoom, setPublicJoinRoom] = useState(null)
  const isCreateFormComplete = createTitle.trim().length > 0
  const roomUpdateVersion = useChatRealtimeStore((state) => state.roomUpdateVersion)
  const setHasUnreadChat = useChatRealtimeStore((state) => state.setHasUnreadChat)
  const hasRealtimeInitializedRef = useRef(false)

  useEffect(() => {
    const redirectedError = location.state?.chatRedirectError

    if (typeof redirectedError !== 'string' || !redirectedError.trim()) {
      return
    }

    setJoinError(normalizeChatRoomLabel(redirectedError.trim()))
    navigate('/chat', { replace: true, state: null })
  }, [location.state, navigate])

  const fetchRooms = useCallback(
    async ({ cursor = null, append = false, background = false } = {}) => {
      if (append) {
        setIsLoadingMore(true)
      } else if (!background) {
        setIsLoading(true)
      }
      if (!background) {
        setLoadError('')
        setJoinError('')
      }

      try {
        const response = await getChatRoomList({
          scope,
          keyword,
          cursor,
          limit: PAGE_LIMIT,
        })

        setRooms((previous) => (append ? [...previous, ...response.items] : response.items))
        if (scope === 'joined') {
          setJoinedRoomIds((previous) => {
            const next = new Set(previous)
            let changed = false

            response.items.forEach((item) => {
              const roomId = Number(item?.roomId)
              if (Number.isInteger(roomId) && roomId > 0 && !next.has(roomId)) {
                next.add(roomId)
                changed = true
              }
            })

            return changed ? next : previous
          })
        }
        setNextCursor(response.nextCursor)
        setHasNextPage(Boolean(response.hasNextPage))

        if (scope === 'joined' && !keyword && !append) {
          const hasUnreadInFirstPage = response.items.some(
            (item) => Number(item.unreadCount ?? 0) > 0,
          )
          if (hasUnreadInFirstPage) {
            setHasUnreadChat(true)
          } else if (!response.hasNextPage) {
            setHasUnreadChat(false)
          }
        }
      } catch {
        if (!append && !background) {
          setRooms([])
          setNextCursor(null)
          setHasNextPage(false)
        }
        if (!background) {
          setLoadError('채팅방 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.')
        }
      } finally {
        if (append) {
          setIsLoadingMore(false)
        } else if (!background) {
          setIsLoading(false)
        }
      }
    },
    [keyword, scope, setHasUnreadChat],
  )

  useEffect(() => {
    fetchRooms()
  }, [fetchRooms])

  useEffect(() => {
    if (scope !== 'joined') {
      return
    }

    if (!hasRealtimeInitializedRef.current) {
      hasRealtimeInitializedRef.current = true
      return
    }

    const timer = window.setTimeout(() => {
      fetchRooms({ background: true })
    }, 120)

    return () => {
      window.clearTimeout(timer)
    }
  }, [fetchRooms, roomUpdateVersion, scope])

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

  const openCreateModal = () => {
    setIsCreateOpen(true)
    setCreateError('')
  }

  const closeCreateModal = () => {
    setIsCreateOpen(false)
    setCreateError('')
  }

  const openPasswordDialog = (room) => {
    setPasswordRoom({
      roomId: room.roomId,
      title: room.title,
      participantCount: room.participantCount,
    })
    setPasswordInput('')
    setPasswordError('')
    setIsPasswordDialogOpen(true)
  }

  const closePasswordDialog = () => {
    if (pendingRoomId != null) {
      return
    }

    setIsPasswordDialogOpen(false)
    setPasswordRoom(null)
    setPasswordInput('')
    setPasswordError('')
  }

  const openPublicJoinDialog = (room) => {
    setPublicJoinRoom({
      roomId: room.roomId,
      title: room.title,
      participantCount: room.participantCount,
    })
    setIsPublicJoinDialogOpen(true)
  }

  const closePublicJoinDialog = () => {
    if (pendingRoomId != null) {
      return
    }

    setIsPublicJoinDialogOpen(false)
    setPublicJoinRoom(null)
  }

  const handleCreateSubmit = async (event) => {
    event.preventDefault()

    if (isCreating) {
      return
    }

    if (!isCreateFormComplete) {
      setCreateError('채팅방 제목을 입력해주세요.')
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
        state: { roomTitle: createTitle.trim(), participantsCount: 1 },
      })
    } catch (error) {
      setCreateError(toCreateErrorMessage(error))
    } finally {
      setIsCreating(false)
    }
  }

  const handleOpenRoom = async (room) => {
    const roomId = Number(room.roomId)
    const participantsCount = Number(room.participantsCount ?? room.participantCount)

    if (!Number.isInteger(roomId) || roomId <= 0) {
      setJoinError('유효하지 않은 채팅방입니다.')
      return
    }

    if (pendingRoomId === roomId) {
      return
    }

    setJoinError('')

    if (scope === 'joined' || Boolean(room.isJoined)) {
      navigate(`/chat/${roomId}`, {
        state: {
          roomTitle: room.title,
          participantsCount: Number.isInteger(participantsCount) ? participantsCount : undefined,
        },
      })
      return
    }

    if (room.hasPassword) {
      setPendingRoomId(roomId)

      try {
        await joinChatRoom({ roomId })
        navigate(`/chat/${roomId}`, {
          state: { roomTitle: room.title, participantsCount: room.participantCount },
        })
      } catch (error) {
        const code = error?.response?.data?.code
        if (code === 'CHAT_ROOM_ALREADY_JOINED') {
          navigate(`/chat/${roomId}`, {
            state: { roomTitle: room.title, participantsCount: room.participantCount },
          })
          return
        }
        if (code === 'CHAT_ROOM_INVALID_PASSWORD') {
          openPasswordDialog(room)
          return
        }
        setJoinError(toJoinErrorMessage(error))
      } finally {
        setPendingRoomId(null)
      }
      return
    }

    openPublicJoinDialog(room)
  }

  const handlePasswordJoinSubmit = async (event) => {
    event.preventDefault()

    const roomId = Number(passwordRoom?.roomId)
    if (!Number.isInteger(roomId) || roomId <= 0) {
      setPasswordError('유효하지 않은 채팅방입니다.')
      return
    }

    if (pendingRoomId === roomId) {
      return
    }

    const password = passwordInput.trim()
    if (!password) {
      setPasswordError('비밀번호를 입력해주세요.')
      return
    }

    setPasswordError('')
    setJoinError('')
    setPendingRoomId(roomId)

    try {
      await joinChatRoom({ roomId, password })
      setIsPasswordDialogOpen(false)
      setPasswordRoom(null)
      setPasswordInput('')
      navigate(`/chat/${roomId}`, {
        state: {
          roomTitle: passwordRoom?.title ?? `채팅방 #${roomId}`,
          participantsCount: passwordRoom?.participantCount,
        },
      })
    } catch (error) {
      const code = error?.response?.data?.code
      if (code === 'CHAT_ROOM_ALREADY_JOINED') {
        setIsPasswordDialogOpen(false)
        setPasswordRoom(null)
        setPasswordInput('')
        navigate(`/chat/${roomId}`, {
          state: {
            roomTitle: passwordRoom?.title ?? `채팅방 #${roomId}`,
            participantsCount: passwordRoom?.participantCount,
          },
        })
        return
      }
      setPasswordError(toJoinErrorMessage(error))
    } finally {
      setPendingRoomId(null)
    }
  }

  const handlePublicJoinConfirm = async () => {
    const roomId = Number(publicJoinRoom?.roomId)
    if (!Number.isInteger(roomId) || roomId <= 0) {
      setJoinError('유효하지 않은 채팅방입니다.')
      return
    }

    if (pendingRoomId === roomId) {
      return
    }

    setJoinError('')
    setPendingRoomId(roomId)

    try {
      await joinChatRoom({ roomId })
      setIsPublicJoinDialogOpen(false)
      setPublicJoinRoom(null)
      navigate(`/chat/${roomId}`, {
        state: {
          roomTitle: publicJoinRoom?.title ?? `채팅방 #${roomId}`,
          participantsCount: publicJoinRoom?.participantCount,
        },
      })
    } catch (error) {
      const code = error?.response?.data?.code
      if (code === 'CHAT_ROOM_ALREADY_JOINED') {
        setIsPublicJoinDialogOpen(false)
        setPublicJoinRoom(null)
        navigate(`/chat/${roomId}`, {
          state: {
            roomTitle: publicJoinRoom?.title ?? `채팅방 #${roomId}`,
            participantsCount: publicJoinRoom?.participantCount,
          },
        })
        return
      }
      setJoinError(toJoinErrorMessage(error))
    } finally {
      setPendingRoomId(null)
    }
  }

  const emptyMessage = useMemo(() => getEmptyMessage(scope, keyword), [scope, keyword])

  return (
    <>
      <Dialog
        open={isCreateOpen}
        onOpenChange={(nextOpen) => {
          if (nextOpen) {
            setIsCreateOpen(true)
          }
        }}
      >
        <div className="space-y-5">
          <Card className="bg-muted/70">
            <CardHeader className="pb-0">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle>오픈채팅</CardTitle>
                </div>
                <Button
                  aria-label="채팅방 생성"
                  className="h-8 w-8 rounded-md border-foreground/20 p-0"
                  onClick={openCreateModal}
                  size="icon"
                  type="button"
                  variant="outline"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>

            <CardContent className="space-y-3 pt-4">
              <form onSubmit={handleSearchSubmit}>
                <label className="relative block" htmlFor="chat-room-keyword">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="chat-room-keyword"
                    className="rounded-full border-0 pl-9 shadow-sm placeholder:text-muted-foreground/40 focus-visible:border focus-visible:border-black focus-visible:ring-0"
                    maxLength={100}
                    onChange={(event) => setInputKeyword(event.target.value)}
                    placeholder="찾으시는 채팅방 제목을 적어주세요"
                    type="text"
                    value={inputKeyword}
                  />
                </label>
              </form>

              <div className="grid grid-cols-2 gap-2">
                {SCOPE_OPTIONS.map((option) => {
                  const isActive = scope === option.value

                  return (
                    <Button
                      key={option.value}
                      className={`h-9 rounded-full ${
                        isActive
                          ? 'border-info bg-info/10 text-info hover:bg-info/15 hover:text-info'
                          : ''
                      }`}
                      onClick={() => setScope(option.value)}
                      type="button"
                      variant="outline"
                    >
                      {option.label}
                    </Button>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          <DialogContent
            className="p-5"
            onEscapeKeyDown={(event) => event.preventDefault()}
            onInteractOutside={(event) => event.preventDefault()}
            onPointerDownOutside={(event) => event.preventDefault()}
          >
            <form className="flex flex-col gap-5" onSubmit={handleCreateSubmit}>
              <DialogHeader className="space-y-2 text-left">
                <DialogTitle>채팅방 생성</DialogTitle>
                <DialogDescription>생성할 채팅방 정보를 입력해주세요.</DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold" htmlFor="create-chat-room-title">
                    채팅방 제목
                  </label>
                  <Input
                    className="placeholder:text-muted-foreground/40"
                    id="create-chat-room-title"
                    maxLength={MAX_TITLE_LENGTH}
                    onChange={(event) => setCreateTitle(event.target.value)}
                    placeholder="예) 백준 실버 문제 풀이방"
                    type="text"
                    value={createTitle}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold" htmlFor="create-chat-room-password">
                    비밀번호 (선택)
                  </label>
                  <Input
                    className="placeholder:text-muted-foreground/40"
                    id="create-chat-room-password"
                    maxLength={MAX_PASSWORD_LENGTH}
                    onChange={(event) => setCreatePassword(event.target.value)}
                    placeholder="비밀번호를 입력하면 비공개 채팅방으로 생성됩니다."
                    type="text"
                    value={createPassword}
                  />
                </div>
              </div>

              {createError ? <StatusMessage tone="error">{createError}</StatusMessage> : null}

              <DialogFooter className="flex-row justify-end gap-2">
                <Button
                  disabled={isCreating}
                  onClick={closeCreateModal}
                  type="button"
                  variant="outline"
                >
                  취소
                </Button>
                <Button disabled={isCreating || !isCreateFormComplete} type="submit">
                  {isCreating ? '생성 중...' : '생성'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>

          {loadError ? (
            <Card className="border-dashed border-muted-foreground/40 bg-muted/40 p-4 text-center">
              <StatusMessage tone="error">{loadError}</StatusMessage>
            </Card>
          ) : null}

          {joinError ? (
            <Card className="border-dashed border-muted-foreground/40 bg-muted/40 p-4 text-center">
              <StatusMessage tone="error">{joinError}</StatusMessage>
            </Card>
          ) : null}

          <section className="space-y-4">
            {isLoading ? (
              <Card className="border-dashed border-muted-foreground/40 bg-muted/40 p-6 text-center">
                <StatusMessage>채팅방을 불러오는 중입니다.</StatusMessage>
              </Card>
            ) : null}

            {!isLoading && rooms.length === 0 ? (
              <Card className="border-dashed border-muted-foreground/40 bg-muted/40 p-6 text-center">
                <StatusMessage>{emptyMessage}</StatusMessage>
              </Card>
            ) : null}

            {!isLoading && rooms.length > 0 ? (
              <ul className="space-y-3">
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
                      room={{
                        ...room,
                        isJoined:
                          Boolean(room.isJoined) ||
                          (Number.isInteger(roomId) && joinedRoomIds.has(roomId)),
                      }}
                    />
                  )
                })}
              </ul>
            ) : null}

            {!isLoading && hasNextPage ? (
              <Button
                className="w-full"
                disabled={isLoadingMore}
                onClick={handleLoadMore}
                type="button"
                variant="outline"
              >
                {isLoadingMore ? '불러오는 중...' : '더 불러오기'}
              </Button>
            ) : null}
          </section>
        </div>
      </Dialog>

      <Dialog
        open={isPasswordDialogOpen}
        onOpenChange={(nextOpen) => {
          if (nextOpen) {
            setIsPasswordDialogOpen(true)
          }
        }}
      >
        <DialogContent
          className="p-5"
          onEscapeKeyDown={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
          onPointerDownOutside={(event) => event.preventDefault()}
        >
          <form className="flex flex-col gap-5" onSubmit={handlePasswordJoinSubmit}>
            <DialogHeader className="space-y-2 text-left">
              <DialogTitle>비밀번호 입력</DialogTitle>
              <DialogDescription className="text-muted-foreground/60">
                비밀번호 입력이 필요한 채팅방입니다.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-1">
              <label className="text-xs font-semibold" htmlFor="join-chat-room-password"></label>
              <Input
                className="placeholder:text-muted-foreground/40"
                id="join-chat-room-password"
                maxLength={MAX_PASSWORD_LENGTH}
                onChange={(event) => setPasswordInput(event.target.value)}
                placeholder="비밀번호를 입력해주세요."
                type="password"
                value={passwordInput}
              />
            </div>

            {passwordError ? <StatusMessage tone="error">{passwordError}</StatusMessage> : null}

            <DialogFooter className="flex-row justify-end gap-2">
              <Button
                disabled={pendingRoomId != null}
                onClick={closePasswordDialog}
                type="button"
                variant="outline"
              >
                취소
              </Button>
              <Button
                disabled={pendingRoomId != null || passwordInput.trim().length === 0}
                type="submit"
              >
                {pendingRoomId != null ? '입장 중...' : '입장'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isPublicJoinDialogOpen}
        onOpenChange={(nextOpen) => {
          if (nextOpen) {
            setIsPublicJoinDialogOpen(true)
          }
        }}
      >
        <DialogContent
          className="p-5"
          onEscapeKeyDown={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
          onPointerDownOutside={(event) => event.preventDefault()}
        >
          <div className="flex flex-col gap-5">
            <DialogHeader className="space-y-2 text-left">
              <DialogTitle>채팅방 입장</DialogTitle>
              <DialogDescription className="text-muted-foreground/60">
                {publicJoinRoom?.title ?? '선택한 채팅방'}에 입장하시겠습니까?
              </DialogDescription>
            </DialogHeader>

            <DialogFooter className="flex-row justify-end gap-2">
              <Button
                disabled={pendingRoomId != null}
                onClick={closePublicJoinDialog}
                type="button"
                variant="outline"
              >
                취소
              </Button>
              <Button
                disabled={pendingRoomId != null}
                onClick={handlePublicJoinConfirm}
                type="button"
              >
                {pendingRoomId != null ? '입장 중...' : '입장'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
