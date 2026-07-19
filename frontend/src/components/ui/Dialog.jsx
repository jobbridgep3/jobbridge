import * as DialogPrimitive from '@radix-ui/react-dialog'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import { createContext, useState } from 'react'

import { modalContent, modalOverlay } from '../../lib/motion'
import { cn } from '../../lib/utils'

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger

/** The nearest ancestor DialogContent's own DOM node, or null outside any
 * Dialog. Radix Dialog's trapped FocusScope only recognizes focus targets
 * that are DOM descendants of this node — a Popover (e.g. DatePicker/
 * TimePicker) that portals to document.body by default lands outside it,
 * so the Dialog keeps yanking focus back and fights the Popover's own
 * interaction. Consumers that need a nested Popover/Select to actually work
 * read this context and pass it as that Popover's Portal `container`. */
export const DialogContainerContext = createContext(null)

export function DialogContent({ className, children, title, description, ...props }) {
  const [container, setContainer] = useState(null)
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay asChild>
        <motion.div {...modalOverlay} className="fixed inset-0 z-50 bg-surface-overlay backdrop-blur-[2px]" />
      </DialogPrimitive.Overlay>
      <DialogPrimitive.Content asChild {...props}>
        <motion.div
          ref={setContainer}
          {...modalContent}
          className={cn(
            'fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl bg-surface p-6 shadow-xl',
            className
          )}
        >
          <div className="mb-4 flex items-start justify-between">
            <div>
              {title && <DialogPrimitive.Title className="text-base font-semibold text-text-primary">{title}</DialogPrimitive.Title>}
              {description && (
                <DialogPrimitive.Description className="mt-1 text-sm text-text-muted">{description}</DialogPrimitive.Description>
              )}
            </div>
            <DialogPrimitive.Close className="rounded-md p-1 text-text-muted hover:bg-surface-hover hover:text-text-secondary">
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
          </div>
          <DialogContainerContext.Provider value={container}>{children}</DialogContainerContext.Provider>
        </motion.div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}
