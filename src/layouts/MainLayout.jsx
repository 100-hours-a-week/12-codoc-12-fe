export default function MainLayout({ title = 'Codoc', children }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex max-w-3xl items-center justify-between p-4">
          <h1 className="text-lg font-semibold">{title}</h1>
          <span className="text-xs text-muted-foreground">v0</span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl p-4">{children}</main>
    </div>
  )
}
