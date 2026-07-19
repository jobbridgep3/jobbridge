import * as PopoverPrimitive from '@radix-ui/react-popover'
import dayjs from 'dayjs'
import { motion } from 'framer-motion'
import { CalendarDays } from 'lucide-react'
import { useMemo, useState } from 'react'
import { DayPicker } from 'react-day-picker'
import 'react-day-picker/style.css'

import { dropdownMenu } from '../../lib/motion'
import { cn } from '../../lib/utils'

const dayPickerClassNames = {
  root: 'p-3',
  months: 'flex flex-col',
  month: 'space-y-3',
  month_caption: 'flex items-center justify-center px-8 text-sm font-medium text-text-primary',
  dropdowns: 'flex items-center justify-center gap-1.5',
  dropdown_root: 'relative inline-flex items-center',
  dropdown: 'absolute inset-0 h-full w-full cursor-pointer opacity-0',
  months_dropdown: '',
  years_dropdown: '',
  caption_label: 'inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-sm font-medium text-text-primary hover:bg-surface-hover',
  nav: 'flex items-center justify-between absolute inset-x-1 top-3',
  button_previous: 'h-7 w-7 rounded-md text-text-muted hover:bg-surface-hover flex items-center justify-center disabled:opacity-30',
  button_next: 'h-7 w-7 rounded-md text-text-muted hover:bg-surface-hover flex items-center justify-center disabled:opacity-30',
  month_grid: 'w-full border-collapse',
  weekdays: 'flex',
  weekday: 'w-9 text-center text-xs font-medium text-text-muted',
  week: 'flex w-full mt-1',
  day: 'h-9 w-9 text-center text-sm p-0 relative',
  day_button: 'h-9 w-9 rounded-md text-text-secondary hover:bg-primary-50 dark:hover:bg-primary-900/40 flex items-center justify-center transition-colors',
  selected: '[&>button]:bg-primary-800 [&>button]:text-white [&>button]:hover:bg-primary-900',
  today: '[&>button]:font-semibold [&>button]:text-primary-700 dark:[&>button]:text-primary-300',
  outside: '[&>button]:text-text-muted [&>button]:opacity-50',
  disabled: '[&>button]:text-text-muted [&>button]:opacity-50 [&>button]:hover:bg-transparent [&>button]:cursor-not-allowed',
}

/** ISO "yyyy-mm-dd" <-> Date, matching what native <input type="date"> produced
 * and what the backend's marshmallow fields.Date expects. */
function toDate(iso) {
  if (!iso) return undefined
  const d = dayjs(iso, 'YYYY-MM-DD', true)
  return d.isValid() ? d.toDate() : undefined
}

function toIso(date) {
  return date ? dayjs(date).format('YYYY-MM-DD') : ''
}

/**
 * Shared calendar date picker. `value`/`onChange` use ISO "yyyy-mm-dd" strings
 * (same shape native <input type="date"> used) so it's a drop-in replacement.
 */
export function DatePicker({ value, onChange, minDate, maxDate, placeholder = 'Select date', disabled, className }) {
  const [open, setOpen] = useState(false)
  const selected = useMemo(() => toDate(value), [value])
  const matcher = useMemo(() => {
    const min = toDate(minDate)
    const max = toDate(maxDate)
    const m = []
    if (min) m.push({ before: min })
    if (max) m.push({ after: max })
    return m.length ? m : undefined
  }, [minDate, maxDate])

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'flex h-10 w-full items-center justify-between rounded-lg border border-border-hover bg-surface px-3 text-left text-sm text-text-primary focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary-500 disabled:cursor-not-allowed disabled:bg-surface-secondary',
            !selected && 'text-text-muted',
            className
          )}
        >
          <span>{selected ? dayjs(selected).format('MMM D, YYYY') : placeholder}</span>
          <CalendarDays className="h-4 w-4 shrink-0 text-text-muted" />
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content asChild align="start" sideOffset={6}>
          <motion.div {...dropdownMenu} className="z-50 rounded-lg border border-border bg-surface shadow-lg">
            <DayPicker
              mode="single"
              captionLayout="dropdown"
              startMonth={new Date(new Date().getFullYear() - 100, 0)}
              endMonth={new Date(new Date().getFullYear() + 10, 11)}
              selected={selected}
              defaultMonth={selected}
              onSelect={(date) => { onChange(toIso(date)); setOpen(false) }}
              disabled={matcher}
              classNames={dayPickerClassNames}
            />
          </motion.div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}
