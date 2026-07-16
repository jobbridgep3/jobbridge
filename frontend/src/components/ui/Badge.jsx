import { cva } from 'class-variance-authority'

import { cn } from '../../lib/utils'

const badgeVariants = cva('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', {
  variants: {
    variant: {
      default: 'bg-surface-hover text-text-secondary',
      primary: 'bg-primary-100 text-primary-800 dark:bg-primary-900/40 dark:text-primary-300',
      success: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
      warning: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
      danger: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
      info: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
      // Notification priority levels
      normal: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
      important: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
      urgent: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
    },
  },
  defaultVariants: { variant: 'default' },
})

export function Badge({ className, variant, ...props }) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}
