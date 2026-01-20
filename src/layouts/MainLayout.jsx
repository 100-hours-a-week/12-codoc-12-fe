import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'

export default function MainLayout({ title = 'Codoc', children }) {
  const [pageTitle, setPageTitle] = useState(title)
  useEffect(() => {
    setPageTitle(title)
  }, [title])

  const content = children ?? <Outlet context={{ setPageTitle }} />

  return (
    <div className="min-h-screen bg-muted/40 text-foreground">
      <div className="mx-auto min-h-screen w-full max-w-[430px] bg-background shadow-sm sm:max-w-[520px] md:max-w-[720px] lg:max-w-[960px]">
        <header className="border-b bg-background">
          <div className="flex items-center justify-between px-4 py-4 sm:px-6">
            <h1 className="text-lg font-semibold">{pageTitle}</h1>
            <span className="text-xs text-muted-foreground">v0</span>
          </div>
        </header>
        <main className="px-4 py-6 sm:px-6 sm:py-8">{content}</main>
      </div>
    </div>
  )
}
