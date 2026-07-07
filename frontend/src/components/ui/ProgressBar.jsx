import { motion } from 'framer-motion'

import { cn } from '../../lib/utils'

export function ProgressBar({ percent = 0, label, compact = false, className }) {
  const clamped = Math.max(0, Math.min(100, percent))
  const color = clamped >= 100 ? 'bg-green-600' : clamped >= 50 ? 'bg-primary-700' : 'bg-amber-500'

  return (
    <div className={cn('w-full', className)}>
      {!compact && (
        <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
          <span>{label || 'Profile Completion'}</span>
          <span className="font-medium text-slate-700">{clamped}%</span>
        </div>
      )}
      <div className={cn('rounded-full bg-slate-100', compact ? 'h-1.5' : 'h-2')}>
        <motion.div
          className={cn('rounded-full', compact ? 'h-1.5' : 'h-2', color)}
          initial={{ width: 0 }}
          animate={{ width: `${clamped}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>
      {compact && <span className="mt-0.5 block text-xs text-slate-500">{clamped}%</span>}
    </div>
  )
}
