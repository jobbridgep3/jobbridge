import { motion } from 'framer-motion'

import { cardHover } from '../../lib/motion'
import { cn } from '../../lib/utils'

export function StatCard({ label, value, icon: Icon, tone = 'primary', className }) {
  const toneClasses = {
    primary: 'bg-primary-50 text-primary-700',
    success: 'bg-green-50 text-green-700',
    warning: 'bg-amber-50 text-amber-700',
    danger: 'bg-red-50 text-red-700',
  }
  return (
    <motion.div
      {...cardHover}
      className={cn('flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-[var(--shadow-card)]', className)}
    >
      {Icon && (
        <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-lg', toneClasses[tone])}>
          <Icon className="h-5 w-5" />
        </div>
      )}
      <div className="min-w-0">
        <p className="truncate text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        <p className="text-2xl font-semibold text-slate-900">{value}</p>
      </div>
    </motion.div>
  )
}
