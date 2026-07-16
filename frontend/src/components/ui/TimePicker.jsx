import * as PopoverPrimitive from '@radix-ui/react-popover'
import { motion } from 'framer-motion'
import { Clock } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { dropdownMenu } from '../../lib/motion'
import { cn } from '../../lib/utils'

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1)
const MINUTES = ['00', '15', '30', '45']

/** "h:mm AM/PM" (e.g. "9:00 AM") <-> { hour, minute, period } parts. */
function parseTime(value) {
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec((value || '').trim())
  if (!match) return { hour: null, minute: null, period: null }
  return { hour: Number(match[1]), minute: match[2], period: match[3].toUpperCase() }
}

function formatTime({ hour, minute, period }) {
  if (!hour || !minute || !period) return ''
  return `${hour}:${minute} ${period}`
}

/**
 * Shared 12-hour time picker (hour / minute / AM-PM selects in a popover) — no
 * manual typing. `value`/`onChange` use "h:mm AM/PM" strings (e.g. "9:00 AM").
 */
export function TimePicker({ value, onChange, placeholder = 'Select time', disabled, className }) {
  // Local state, seeded once from the `value` prop the first time it becomes
  // truthy (e.g. an existing schedule loading in asynchronously), then left
  // alone. Recomputing `parts` fresh from `value` on every render — and
  // closing over that in `update()` — meant three rapid, back-to-back
  // selections (hour, then minute, then AM/PM) could each read a `parts`
  // snapshot from before the previous selection's round trip back through
  // the parent had landed, silently discarding it (e.g. picking hour 7 then
  // minute 45 could win with hour defaulting back to 9).
  //
  // `partsRef` mirrors `parts` but is written synchronously inside the event
  // handler itself (not React state, which only commits on the next render),
  // so back-to-back selections each build on the truly latest values instead
  // of a stale render's closure. `onChange` — which triggers a setState in a
  // different component (the parent form) — is called directly from the
  // event handler rather than from inside a setParts() updater callback,
  // which React disallows (updater functions run during render and must be
  // side-effect-free).
  const [parts, setParts] = useState(() => parseTime(value))
  const partsRef = useRef(parts)
  const initializedRef = useRef(!!value)
  useEffect(() => {
    if (!initializedRef.current && value) {
      const parsed = parseTime(value)
      partsRef.current = parsed
      setParts(parsed)
      initializedRef.current = true
    }
  }, [value])

  const update = (patch) => {
    const next = { ...partsRef.current, ...patch }
    // Default the other two fields the first time any one is picked, so a
    // single selection immediately produces a valid, displayable time.
    if (!next.hour) next.hour = 9
    if (!next.minute) next.minute = '00'
    if (!next.period) next.period = 'AM'
    partsRef.current = next
    setParts(next)
    onChange(formatTime(next))
  }

  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'flex h-10 w-full items-center justify-between rounded-lg border border-border-hover bg-surface px-3 text-left text-sm text-text-primary focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary-500 disabled:cursor-not-allowed disabled:bg-surface-secondary',
            !value && 'text-text-muted',
            className
          )}
        >
          <span>{value || placeholder}</span>
          <Clock className="h-4 w-4 shrink-0 text-text-muted" />
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content asChild align="start" sideOffset={6}>
          <motion.div {...dropdownMenu} className="z-50 flex gap-2 rounded-lg border border-border bg-surface p-3 shadow-lg">
            <select
              value={parts.hour || ''}
              onChange={(e) => update({ hour: Number(e.target.value) })}
              className="h-9 rounded-md border border-border bg-surface px-2 text-sm text-text-primary focus-visible:outline-2 focus-visible:outline-primary-500"
            >
              <option value="" disabled>Hr</option>
              {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
            </select>
            <select
              value={parts.minute || ''}
              onChange={(e) => update({ minute: e.target.value })}
              className="h-9 rounded-md border border-border bg-surface px-2 text-sm text-text-primary focus-visible:outline-2 focus-visible:outline-primary-500"
            >
              <option value="" disabled>Min</option>
              {MINUTES.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <select
              value={parts.period || ''}
              onChange={(e) => update({ period: e.target.value })}
              className="h-9 rounded-md border border-border bg-surface px-2 text-sm text-text-primary focus-visible:outline-2 focus-visible:outline-primary-500"
            >
              <option value="" disabled>—</option>
              <option value="AM">AM</option>
              <option value="PM">PM</option>
            </select>
          </motion.div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}
