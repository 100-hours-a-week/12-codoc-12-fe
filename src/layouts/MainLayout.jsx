import { ArrowLeft, BookOpen, Home, User } from 'lucide-react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'

import { cn } from '@/lib/utils'
import { useChatbotStore } from '@/stores/useChatbotStore'
import { useQuizStore } from '@/stores/useQuizStore'
import { useSummaryCardStore } from '@/stores/useSummaryCardStore'

const navItems = [
  { to: '/', label: '홈', Icon: Home, end: true },
  { to: '/problems', label: '문제집', Icon: BookOpen },
  { to: '/my', label: '마이', Icon: User },
]

export default function MainLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const clearChatbotSessions = useChatbotStore((state) => state.clearSessions)
  const clearQuizSessions = useQuizStore((state) => state.clearSessions)
  const clearSummarySessions = useSummaryCardStore((state) => state.clearSessions)
  const [isChromeHidden, setIsChromeHidden] = useState(false)
  const previousPathRef = useRef(location.pathname)

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
    const path = location.pathname
    const isProblemDetail = /^\/problems\/[^/]+$/.test(path)
    if (isProblemDetail && previousPathRef.current !== path) {
      requestAnimationFrame(() => {
        setIsChromeHidden(false)
        window.scrollTo({ top: 0, behavior: 'auto' })
      })
    }
    previousPathRef.current = path
  }, [location.pathname])

  useEffect(() => {
    let lastScrollY = window.scrollY
    let ticking = false

    const handleScroll = () => {
      const current = window.scrollY
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const delta = current - lastScrollY
          if (Math.abs(delta) > 6) {
            if (delta > 0 && current > 24) {
              setIsChromeHidden(true)
            } else {
              setIsChromeHidden(false)
            }
          }
          lastScrollY = current
          ticking = false
        })
        ticking = true
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  const content = <Outlet />
  const showBackButton = /^\/problems\/[^/]+/.test(location.pathname)

  const handleBack = () => {
    navigate('/problems')
  }

  return (
    <div className="min-h-screen bg-muted/40 text-foreground">
      <div
        className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col bg-background shadow-sm"
        style={{ '--chatbot-input-bottom': isChromeHidden ? '16px' : '72px' }}
      >
        <header
          className={`sticky top-0 z-30  bg-background/95 backdrop-blur transition-transform duration-200 ${
            isChromeHidden ? '-translate-y-full' : 'translate-y-0'
          }`}
        >
          <div className="relative flex items-center justify-center px-4 py-3 sm:px-6 sm:py-4">
            {showBackButton ? (
              <button
                aria-label="뒤로 가기"
                className="absolute left-4 flex h-9 w-9 items-center justify-center rounded-full bg-transparent text-foreground transition hover:bg-muted/60"
                onClick={handleBack}
                type="button"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            ) : null}
            <h1 className="inline-flex items-baseline text-xl font-semibold tracking-tight sm:text-2xl">
              <span aria-hidden>Codo</span>
              <span aria-hidden className="inline-block scale-x-[-1]">
                C
              </span>
              <span className="sr-only">Codoc</span>
            </h1>
          </div>
        </header>
        <main className="flex-1 px-4 py-5 pb-24 sm:pb-28">{content}</main>
        <footer
          className={`fixed bottom-0 left-1/2 w-full max-w-[430px] -translate-x-1/2 transition-transform duration-200 ${
            isChromeHidden ? 'translate-y-[120%]' : 'translate-y-0'
          }`}
        >
          <div className="pb-[env(safe-area-inset-bottom)]">
            <nav className="grid grid-cols-3 rounded-t-2xl rounded-b-none bg-white/95 px-5 py-2 shadow-[0_-6px_20px_rgba(0,0,0,0.08)] backdrop-blur">
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
                      <Icon className="h-6 w-6" />
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
      </div>
    </div>
  )
}
