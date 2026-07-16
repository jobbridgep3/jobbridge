import { forwardRef } from 'react'

import { cn } from '../../lib/utils'

export const Input = forwardRef(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      'flex h-10 w-full rounded-lg border border-border-hover bg-surface px-3 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary-500 disabled:cursor-not-allowed disabled:bg-surface-secondary',
      className
    )}
    {...props}
  />
))
Input.displayName = 'Input'

export const Textarea = forwardRef(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'flex w-full rounded-lg border border-border-hover bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary-500 disabled:cursor-not-allowed disabled:bg-surface-secondary',
      className
    )}
    {...props}
  />
))
Textarea.displayName = 'Textarea'

export const Label = forwardRef(({ className, ...props }, ref) => (
  <label ref={ref} className={cn('mb-1.5 block text-sm font-medium text-text-secondary', className)} {...props} />
))
Label.displayName = 'Label'

export const Select = forwardRef(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      'flex h-10 w-full rounded-lg border border-border-hover bg-surface px-3 text-sm text-text-primary focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary-500',
      className
    )}
    {...props}
  >
    {children}
  </select>
))
Select.displayName = 'Select'

export function FormError({ children }) {
  if (!children) return null
  return <p className="mt-1 text-xs text-red-600">{children}</p>
}
