import { BookOpen, Home, User } from 'lucide-react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'

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

  useEffect(() => {
    const path = location.pathname
    const isProblemFlow = /^\/problems\/[^/]+(\/(chatbot|quiz))?$/.test(path)
    if (!isProblemFlow) {
      clearChatbotSessions()
      clearQuizSessions()
      clearSummarySessions()
    }
  }, [clearChatbotSessions, clearQuizSessions, clearSummarySessions, location.pathname])

  const content = <Outlet />

  return (
    <div className="h-screen overflow-hidden bg-muted/40 text-foreground">
      <div className="mx-auto flex h-full w-full max-w-[430px] flex-col bg-background shadow-sm">
        <header className="border-b bg-background">
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
        <main className="flex-1 overflow-y-auto px-4 py-5">{content}</main>
        <footer className="shrink-0 border-t bg-background/95 backdrop-blur">
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
