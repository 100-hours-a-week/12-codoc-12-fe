import { cn } from '@/lib/utils'

export function Button({ variant = 'primary', className, ...props }) {
  const baseClasses =
    'inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium transition'
  const variantClasses =
    variant === 'primary'
      ? 'bg-primary text-primary-foreground hover:opacity-90'
      : 'bg-secondary text-secondary-foreground hover:opacity-90'

  return <button className={cn(baseClasses, variantClasses, className)} type="button" {...props} />
}
