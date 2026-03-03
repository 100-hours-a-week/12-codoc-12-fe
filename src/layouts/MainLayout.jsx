import { ArrowLeft, Bell, BookOpen, Home, MessageCircle, User } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'

import SessionTimer from '@/components/SessionTimer'
import { useChatRealtimeBootstrap } from '@/hooks/useChatRealtimeBootstrap'
import { useNotificationBootstrap } from '@/hooks/useNotificationBootstrap'
import { isSessionExpired } from '@/lib/session'
import { useSessionCountdown } from '@/hooks/useSessionCountdown'
import { cn } from '@/lib/utils'
import { getActiveProblemSession } from '@/services/problems/problemsService'
import { useChatbotStore } from '@/stores/useChatbotStore'
import { useChatRealtimeStore } from '@/stores/useChatRealtimeStore'
import { useNotificationStore } from '@/stores/useNotificationStore'
import { useProblemSessionStore } from '@/stores/useProblemSessionStore'
import { useQuizStore } from '@/stores/useQuizStore'
import { useSummaryCardStore } from '@/stores/useSummaryCardStore'

const navItems = [
  { to: '/', label: '홈', Icon: Home, end: true },
  { to: '/problems', label: '문제집', Icon: BookOpen },
  { to: '/chat', label: '오픈채팅', Icon: MessageCircle },
  { to: '/my', label: '마이', Icon: User },
]

export default function MainLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const clearChatbotSessions = useChatbotStore((state) => state.clearSessions)
  const clearQuizSessions = useQuizStore((state) => state.clearSessions)
  const clearSummarySessions = useSummaryCardStore((state) => state.clearSessions)
  const hasUnread = useNotificationStore((state) => state.hasUnread)
  const hasUnreadChat = useChatRealtimeStore((state) => state.hasUnreadChat)
  const setProblemSession = useProblemSessionStore((state) => state.setSession)
  const clearProblemSessions = useProblemSessionStore((state) => state.clearAllSessions)
  const problemSessions = useProblemSessionStore((state) => state.sessions)
  const previousPathRef = useRef(location.pathname)
  const sessionCheckRef = useRef(false)
  const shellRef = useRef(null)
  const [shellRect, setShellRect] = useState({ left: 0, width: 0 })

  useNotificationBootstrap()
  useChatRealtimeBootstrap()

  useEffect(() => {
    const path = location.pathname
    const isProblemFlow = /^\/problems\/[^/]+(\/(chatbot|quiz|summary))?$/.test(path)
    if (!isProblemFlow) {
      clearChatbotSessions()
      clearQuizSessions()
      clearSummarySessions()
    }
  }, [clearChatbotSessions, clearQuizSessions, clearSummarySessions, location.pathname])

  useEffect(() => {
    let isActive = true

    const checkActiveSession = async () => {
      if (sessionCheckRef.current) {
        return
      }
      sessionCheckRef.current = true
      try {
        const activeSession = await getActiveProblemSession()
        if (!isActive || !activeSession?.problemId) {
          return
        }
        clearProblemSessions()
        setProblemSession(activeSession.problemId, activeSession)
      } catch (error) {
        if (!isActive) {
          return
        }
        const status = error?.response?.status
        if (status === 404) {
          clearProblemSessions()
          return
        }
        if (status) {
          // Ignore non-404 errors for now to avoid blocking navigation.
        }
      } finally {
        sessionCheckRef.current = false
      }
    }

    checkActiveSession()

    return () => {
      isActive = false
    }
  }, [clearProblemSessions, location.pathname, navigate, setProblemSession])

  useEffect(() => {
    const path = location.pathname
    const isProblemDetail = /^\/problems\/[^/]+$/.test(path)
    const isProblemFlow = /^\/problems\/[^/]+(\/(chatbot|quiz|summary))?$/.test(path)
    if (isProblemFlow && previousPathRef.current !== path) {
      requestAnimationFrame(() => {
        if (isProblemDetail) {
          window.scrollTo({ top: 0, behavior: 'auto' })
        }
      })
    }
    previousPathRef.current = path
  }, [location.pathname])

  useEffect(() => {
    const updateRect = () => {
      if (!shellRef.current) {
        return
      }
      const rect = shellRef.current.getBoundingClientRect()
      setShellRect({ left: rect.left, width: rect.width })
    }

    updateRect()
    let observer = null
    if (typeof ResizeObserver !== 'undefined' && shellRef.current) {
      observer = new ResizeObserver(updateRect)
      observer.observe(shellRef.current)
    }
    window.addEventListener('resize', updateRect)
    return () => {
      window.removeEventListener('resize', updateRect)
      if (observer) {
        observer.disconnect()
      }
    }
  }, [])

  const content = <Outlet />
  const isProblemPath = /^\/problems\/[^/]+/.test(location.pathname)
  const isProblemFlowPath = /^\/problems\/[^/]+(\/(chatbot|quiz|summary))?$/.test(location.pathname)
  const isChatbotPath = /^\/problems\/[^/]+\/chatbot$/.test(location.pathname)
  const isChatRoomDetailPath = /^\/chat\/[^/]+$/.test(location.pathname)
  const currentProblemIdMatch = location.pathname.match(/^\/problems\/([^/]+)/)
  const currentProblemId = currentProblemIdMatch?.[1] ?? null
  const isFullHeightPage = isChatRoomDetailPath || isChatbotPath

  const showBackButton = isProblemPath || isChatRoomDetailPath
  const isNavHidden = isProblemFlowPath || isChatRoomDetailPath
  const showNotificationButton = !showBackButton
  const activeSession = useMemo(() => {
    const items = Object.values(problemSessions)
    return items.find((entry) => entry?.sessionId) ?? null
  }, [problemSessions])
  const isActiveSessionExpired = isSessionExpired(activeSession?.expiresAt)
  const isSameProblemPath =
    currentProblemId &&
    activeSession?.problemId &&
    String(currentProblemId) === String(activeSession.problemId)
  const showSessionBar =
    activeSession?.problemId &&
    !isActiveSessionExpired &&
    !isChatRoomDetailPath &&
    (!isProblemFlowPath || !isSameProblemPath)
  const { timeLeftMs: sessionTimeLeftMs } = useSessionCountdown(
    showSessionBar ? activeSession?.expiresAt : null,
  )
  const sessionBarStyle = useMemo(() => {
    let color = 'hsl(217 91% 60% / 0.9)'
    if (sessionTimeLeftMs !== null && sessionTimeLeftMs !== undefined) {
      if (sessionTimeLeftMs <= 60_000) {
        color = 'hsl(0 91% 60% / 0.9)'
      } else if (sessionTimeLeftMs <= 300_000) {
        color = 'hsl(28 91% 60% / 0.9)'
      }
    }
    return { backgroundColor: color }
  }, [sessionTimeLeftMs])

  const handleBack = () => {
    if (isChatRoomDetailPath) {
      navigate('/chat')
      return
    }

    navigate('/problems')
  }

  const handleNotificationClick = () => {
    if (location.pathname.startsWith('/notifications')) {
      if (window.history.length > 1) {
        navigate(-1)
      } else {
        navigate('/')
      }
      return
    }

    navigate('/notifications')
  }

  return (
    <div className="min-h-screen bg-muted/40 text-foreground">
      <div
        ref={shellRef}
        className={`mx-auto flex w-full max-w-[430px] flex-col bg-background shadow-sm ${
          isFullHeightPage ? 'h-[100svh] overflow-hidden' : 'min-h-screen'
        }`}
        data-shell="app"
        style={{
          '--chatbot-input-bottom': isNavHidden ? '16px' : '72px',
          '--app-shell-left': `${shellRect.left}px`,
          '--app-shell-width': `${shellRect.width}px`,
        }}
      >
        <header className="sticky top-0 z-30 bg-background/95 backdrop-blur">
          <div className="relative flex items-center justify-center px-4 py-3 sm:px-6 sm:py-4">
            {showBackButton ? (
              <button
                aria-label="뒤로 가기"
                className="absolute left-4 inline-flex h-9 items-center gap-1 rounded-full bg-transparent px-2 text-foreground transition hover:bg-muted/60"
                onClick={handleBack}
                type="button"
              >
                <ArrowLeft className="h-5 w-5" />
                <span className="text-xs font-semibold">
                  {isChatRoomDetailPath ? '오픈채팅 목록' : '문제 목록'}
                </span>
              </button>
            ) : null}

            <button
              className="inline-flex items-baseline text-xl font-semibold tracking-tight sm:text-2xl"
              onClick={() => navigate('/')}
              type="button"
            >
              <span aria-hidden>Codo</span>
              <span aria-hidden className="inline-block scale-x-[-1]">
                C
              </span>
              <span className="sr-only">Codoc</span>
            </button>

            {showNotificationButton ? (
              <button
                aria-label="알림"
                className="absolute right-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-transparent text-foreground transition hover:bg-muted/60"
                onClick={handleNotificationClick}
                type="button"
              >
                <Bell className="h-6 w-6" />
                {hasUnread ? (
                  <span className="absolute right-[9px] top-[9px] h-2.5 w-2.5 rounded-full bg-[hsl(var(--danger))]" />
                ) : null}
                <span className="sr-only">읽지 않은 알림</span>
              </button>
            ) : null}
          </div>
        </header>

        <main
          className={
            isFullHeightPage
              ? 'min-h-0 flex flex-1 overflow-hidden p-0'
              : `flex-1 px-4 py-5 ${isNavHidden ? 'pb-6' : 'pb-24 sm:pb-28'}`
          }
        >
          {content}
        </main>

        {showSessionBar ? (
          <div
            className="fixed z-40"
            style={{
              left: `${shellRect.left}px`,
              width: `${shellRect.width}px`,
              bottom: isNavHidden
                ? 'calc(env(safe-area-inset-bottom) + 16px)'
                : 'calc(env(safe-area-inset-bottom) + 84px)',
            }}
          >
            <button
              className="relative mx-4 flex h-8 w-[calc(100%-2rem)] items-center justify-center rounded-full px-4 text-xs font-semibold text-white shadow-[0_-6px_20px_rgba(0,0,0,0.08)]"
              style={sessionBarStyle}
              type="button"
              onClick={() => navigate(`/problems/${activeSession.problemId}`)}
            >
              <span className="truncate text-center -translate-x-3">탭해서 돌아가기</span>
              {activeSession.expiresAt ? (
                <SessionTimer
                  expiresAt={activeSession.expiresAt}
                  className="absolute right-1 border-white/20 bg-white text-foreground"
                />
              ) : null}
            </button>
          </div>
        ) : null}

        {!isNavHidden ? (
          <footer
            className="fixed bottom-0 z-40"
            style={{ left: `${shellRect.left}px`, width: `${shellRect.width}px` }}
          >
            <div className="pb-[env(safe-area-inset-bottom)]">
              <nav className="grid grid-cols-4 rounded-t-2xl rounded-b-none bg-white/95 px-5 py-2 shadow-[0_-6px_20px_rgba(0,0,0,0.08)] backdrop-blur">
                {navItems.map(({ to, label, Icon, end }) => (
                  <NavLink
                    key={to}
                    className={({ isActive }) =>
                      cn(
                        'flex flex-col items-center gap-1 text-[12px] font-medium transition',
                        isActive ? 'text-info' : 'text-neutral-500',
                      )
                    }
                    end={end}
                    to={to}
                  >
                    {({ isActive: _isActive }) => (
                      <>
                        <span className="relative inline-flex">
                          <Icon className="h-6 w-6" />
                          {to === '/chat' && hasUnreadChat ? (
                            <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-[hsl(var(--danger))]" />
                          ) : null}
                        </span>
                        <span>{label}</span>
                        <span
                          className={`h-[3px] w-6 rounded-full ${
                            _isActive ? 'bg-info' : 'bg-transparent'
                          }`}
                        />
                      </>
                    )}
                  </NavLink>
                ))}
              </nav>
            </div>
          </footer>
        ) : null}
      </div>
    </div>
  )
}
