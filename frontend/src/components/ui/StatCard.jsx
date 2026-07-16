import { motion } from 'framer-motion'

import { cardHover } from '../../lib/motion'
import { cn } from '../../lib/utils'

export function StatCard({ label, value, icon: Icon, tone = 'primary', className }) {
  const toneClasses = {
    primary: 'bg-primary-50 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300',
    success: 'bg-green-50 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    warning: 'bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    danger: 'bg-red-50 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  }
  return (
    <motion.div
      {...cardHover}
      className={cn('flex items-center gap-4 rounded-xl border border-border bg-surface p-5 shadow-[var(--shadow-card)]', className)}
    >
      {Icon && (
        <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-lg', toneClasses[tone])}>
          <Icon className="h-5 w-5" />
        </div>
      )}
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase leading-tight tracking-wide text-text-muted">{label}</p>
        <p className="text-2xl font-semibold text-text-primary">{value}</p>
      </div>
    </motion.div>
  )
}
