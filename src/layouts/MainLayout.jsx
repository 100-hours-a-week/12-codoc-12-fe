import { BookOpen, Home, User } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'

import { cn } from '@/lib/utils'

const navItems = [
  { to: '/', label: '홈', Icon: Home, end: true },
  { to: '/problems', label: '문제집', Icon: BookOpen },
  { to: '/my', label: '마이', Icon: User },
]

export default function MainLayout() {
  const content = <Outlet />

  return (
    <div className="min-h-screen bg-muted/40 text-foreground">
      <div className="mx-auto min-h-screen w-full max-w-[430px] bg-background shadow-sm">
        <header className="border-b bg-background">
          <div className="flex items-center justify-center px-4 py-5 sm:px-6 sm:py-6">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl font-[var(--font-display)]">
              <span aria-hidden>Codo</span>
              <span aria-hidden className="inline-block -translate-y-[1px] scale-x-[-1]">
                C
              </span>
              <span className="sr-only">Codoc</span>
            </h1>
          </div>
        </header>
        <main className="px-4 py-5 pb-24 sm:px-6 sm:py-8 sm:pb-28">{content}</main>
      </div>
      <footer className="fixed bottom-0 left-1/2 w-full max-w-[430px] -translate-x-1/2 border-t bg-background/95 backdrop-blur">
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
  )
}
