import { Slot } from '@radix-ui/react-slot'
import { cva } from 'class-variance-authority'
import { forwardRef } from 'react'

import { cn } from '../../lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-primary-800 text-white hover:bg-primary-900 active:bg-primary-950 dark:bg-primary-600 dark:hover:bg-primary-500 dark:active:bg-primary-400',
        secondary: 'bg-surface text-text-secondary border border-border-hover hover:bg-surface-hover',
        ghost: 'text-text-secondary hover:bg-surface-hover',
        danger: 'bg-red-600 text-white hover:bg-red-700',
        link: 'text-primary-700 hover:underline underline-offset-4',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-10 px-4',
        lg: 'h-11 px-5 text-base',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  }
)

const Button = forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button'
  return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
})
Button.displayName = 'Button'

export { Button, buttonVariants }
