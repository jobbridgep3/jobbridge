import { motion } from 'framer-motion'
import { Inbox } from 'lucide-react'

import { fadeIn } from '../../lib/motion'
import { Button } from './Button'

export function EmptyState({ icon: Icon = Inbox, title = 'Nothing here yet', description, actionLabel, onAction }) {
  return (
    <motion.div {...fadeIn} className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-hover">
        <Icon className="h-6 w-6 text-text-muted" />
      </div>
      <div>
        <p className="text-sm font-semibold text-text-primary">{title}</p>
        {description && <p className="mt-1 max-w-sm text-sm text-text-muted">{description}</p>}
      </div>
      {actionLabel && onAction && (
        <Button size="sm" onClick={onAction} className="mt-2">
          {actionLabel}
        </Button>
      )}
    </motion.div>
  )
}
