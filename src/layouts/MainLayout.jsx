import { BookOpen, Home, User } from 'lucide-react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'

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
  const clearChatbotSessions = useChatbotStore((state) => state.clearSessions)
  const clearQuizSessions = useQuizStore((state) => state.clearSessions)
  const clearSummarySessions = useSummaryCardStore((state) => state.clearSessions)
  const [isChromeHidden, setIsChromeHidden] = useState(false)

  useEffect(() => {
    const path = location.pathname
    const isProblemFlow = /^\/problems\/[^/]+(\/(chatbot|quiz))?$/.test(path)
    if (!isProblemFlow) {
      clearChatbotSessions()
      clearQuizSessions()
      clearSummarySessions()
    }
  }, [clearChatbotSessions, clearQuizSessions, clearSummarySessions, location.pathname])

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

  return (
    <div className="min-h-screen bg-muted/40 text-foreground">
      <div
        className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col bg-background shadow-sm"
        style={{ '--chatbot-input-bottom': isChromeHidden ? '16px' : '72px' }}
      >
        <header
          className={`sticky top-0 z-30 border-b bg-background/95 backdrop-blur transition-transform duration-200 ${
            isChromeHidden ? '-translate-y-full' : 'translate-y-0'
          }`}
        >
          <div className="flex items-center justify-center px-4 py-3 sm:px-6 sm:py-4">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl font-[var(--font-display)]">
              <span aria-hidden>Codo</span>
              <span aria-hidden className="inline-block -translate-y-[1px] scale-x-[-1]">
                C
              </span>
              <span className="sr-only">Codoc</span>
            </h1>
          </div>
        </header>
        <main className="flex-1 px-4 py-5 pb-24 sm:pb-28">{content}</main>
        <footer
          className={`fixed bottom-0 left-1/2 w-full max-w-[430px] -translate-x-1/2 border-t bg-background/95 backdrop-blur transition-transform duration-200 ${
            isChromeHidden ? 'translate-y-full' : 'translate-y-0'
          }`}
        >
          <nav className="grid grid-cols-3 px-6 pb-3 pt-2">
            {navItems.map(({ to, label, Icon, end }) => (
              <NavLink
                key={to}
                className={({ isActive }) =>
                  cn(
                    'flex flex-col items-center gap-1 text-[11px] font-medium',
                    isActive ? 'text-foreground' : 'text-muted-foreground',
                  )
                }
                end={end}
                to={to}
              >
                <Icon className="h-6 w-6" />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>
        </footer>
      </div>
    </div>
  )
}
