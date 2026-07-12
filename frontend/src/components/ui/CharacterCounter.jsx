import { cn } from '../../lib/utils'

/** Wraps any text input with a live character count — pass the current value's
 * length and an optional max (a soft guideline, not enforced) via `count`/`max`. */
export function CharacterCounter({ count, max, className }) {
  const overLimit = max && count > max
  return (
    <p className={cn('mt-1 text-right text-xs text-slate-400', overLimit && 'text-red-500', className)}>
      {count}{max ? ` / ${max}` : ''}
    </p>
  )
}
