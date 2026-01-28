import { cn } from '@/lib/utils'

const toneClasses = {
  muted: 'text-muted-foreground',
  error: 'text-red-500',
  info: 'text-foreground',
}

export default function StatusMessage({ children, tone = 'muted', className }) {
  if (!children) {
    return null
  }
  return (
    <p className={cn('text-xs font-semibold', toneClasses[tone] ?? toneClasses.muted, className)}>
      {children}
    </p>
  )
}
