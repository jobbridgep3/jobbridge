import { AlertTriangle, Check } from 'lucide-react'

import { manila } from '../../lib/manilaTime'
import { cn } from '../../lib/utils'

const DILP_STEPS = [
  { key: 'pending', label: 'Submitted' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'completed', label: 'Interview Completed' },
  { key: 'ready_for_claiming', label: 'Ready for Claiming' },
  { key: 'approved', label: 'Approved' },
  { key: 'submitted_to_esfo', label: 'Submitted to ESFO' },
]

/** 6-node status stepper for a DILP application. `no_show` is not a 7th node — it's a
 * detour/loop-back rather than forward progress, so it renders as a banner instead (see
 * DilpNoShowBanner below), while the stepper itself stays visually pinned at "Scheduled". */
export function DilpStepper({ status, history = [] }) {
  const effectiveStatus = status === 'no_show' ? 'scheduled' : status
  const currentIndex = Math.max(0, DILP_STEPS.findIndex((s) => s.key === effectiveStatus))

  const reachedAt = (stepKey) => {
    const entries = history.filter((h) => h.to_status === stepKey)
    return entries.length ? entries[entries.length - 1].created_at : null
  }

  return (
    <ol className="flex items-center gap-1.5">
      {DILP_STEPS.map((step, i) => {
        const date = reachedAt(step.key)
        return (
          <li key={step.key} className="flex flex-1 items-center gap-1.5">
            <div className="flex flex-col items-center gap-1">
              <span
                className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                  i <= currentIndex ? 'bg-primary-800 text-white' : 'bg-surface-hover text-text-muted',
                )}
              >
                {i < currentIndex ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span className={cn('hidden text-center text-[10px] sm:block', i <= currentIndex ? 'text-text-primary' : 'text-text-muted')}>
                {step.label}
                {date && <span className="block text-text-muted">{manila(date).format('MMM D')}</span>}
              </span>
            </div>
            {i < DILP_STEPS.length - 1 && <div className={cn('h-0.5 flex-1', i < currentIndex ? 'bg-primary-800' : 'bg-surface-hover')} />}
          </li>
        )
      })}
    </ol>
  )
}

/** Amber/red banner shown alongside (not inside) the stepper when the application's
 * current status is `no_show`. */
export function DilpNoShowBanner({ children }) {
  return (
    <div className="mt-3 flex items-start gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div>{children}</div>
    </div>
  )
}
