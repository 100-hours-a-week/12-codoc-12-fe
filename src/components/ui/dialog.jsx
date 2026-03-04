import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'

import { cn } from '@/lib/utils'

const Dialog = DialogPrimitive.Root
const DialogTrigger = DialogPrimitive.Trigger
const DialogPortal = DialogPrimitive.Portal
const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-overlay/40 data-[state=open]:animate-in data-[state=closed]:animate-out',
      className,
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const DialogContent = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          'w-full max-w-[390px] max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-xl border bg-background p-6 shadow-lg',
          className,
        )}
        {...props}
      />
    </div>
  </DialogPortal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({ className, ...props }) => (
  <div className={cn('flex flex-col space-y-1.5', className)} {...props} />
)

const DialogFooter = ({ className, ...props }) => (
  <div
    className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
    {...props}
  />
)

const DialogTitle = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('text-base font-semibold leading-none', className)}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
