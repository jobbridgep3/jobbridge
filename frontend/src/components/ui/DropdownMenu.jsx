import * as DropdownPrimitive from '@radix-ui/react-dropdown-menu'
import { motion } from 'framer-motion'

import { dropdownMenu } from '../../lib/motion'
import { cn } from '../../lib/utils'

export const DropdownMenu = DropdownPrimitive.Root
export const DropdownMenuTrigger = DropdownPrimitive.Trigger

export function DropdownMenuContent({ className, children, align = 'end', ...props }) {
  return (
    <DropdownPrimitive.Portal>
      <DropdownPrimitive.Content asChild align={align} sideOffset={6} {...props}>
        <motion.div
          {...dropdownMenu}
          className={cn('z-50 min-w-[180px] rounded-lg border border-border bg-surface p-1 shadow-lg', className)}
        >
          {children}
        </motion.div>
      </DropdownPrimitive.Content>
    </DropdownPrimitive.Portal>
  )
}

export function DropdownMenuItem({ className, ...props }) {
  return (
    <DropdownPrimitive.Item
      className={cn(
        'flex cursor-pointer select-none items-center gap-2 rounded-md px-2.5 py-2 text-sm text-text-secondary outline-none hover:bg-surface-hover focus:bg-surface-hover',
        className
      )}
      {...props}
    />
  )
}

export const DropdownMenuSeparator = DropdownPrimitive.Separator
