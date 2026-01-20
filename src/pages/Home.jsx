import { Button } from '@/components/Button'
import { useCounterStore } from '@/stores/useCounterStore'

export default function Home() {
  const { count, inc, reset } = useCounterStore()

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        This page is a simple example of a route-level component.
      </p>
      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
        <Button className="w-full sm:w-auto" onClick={inc}>
          Count: {count}
        </Button>
        <Button className="w-full sm:w-auto" variant="secondary" onClick={reset}>
          Reset
        </Button>
      </div>
    </div>
  )
}
