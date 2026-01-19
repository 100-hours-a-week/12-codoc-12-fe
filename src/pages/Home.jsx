import { Button } from '@/components/Button'
import MainLayout from '@/layouts/MainLayout'
import { useCounterStore } from '@/stores/useCounterStore'

export default function Home() {
  const { count, inc, reset } = useCounterStore()

  return (
    <MainLayout title="Home">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          This page is a simple example of a route-level component.
        </p>
        <div className="flex items-center gap-2">
          <Button onClick={inc}>Count: {count}</Button>
          <Button variant="secondary" onClick={reset}>
            Reset
          </Button>
        </div>
      </div>
    </MainLayout>
  )
}
