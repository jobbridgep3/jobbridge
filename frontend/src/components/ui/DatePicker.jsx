import * as PopoverPrimitive from '@radix-ui/react-popover'
import dayjs from 'dayjs'
import { motion } from 'framer-motion'
import { CalendarDays } from 'lucide-react'
import { DayPicker } from 'react-day-picker'
import 'react-day-picker/style.css'

import { dropdownMenu } from '../../lib/motion'
import { cn } from '../../lib/utils'

const dayPickerClassNames = {
  root: 'p-3',
  months: 'flex flex-col',
  month: 'space-y-3',
  month_caption: 'flex items-center justify-center px-8 text-sm font-medium text-slate-900',
  nav: 'flex items-center justify-between absolute inset-x-1 top-3',
  button_previous: 'h-7 w-7 rounded-md text-slate-500 hover:bg-slate-100 flex items-center justify-center disabled:opacity-30',
  button_next: 'h-7 w-7 rounded-md text-slate-500 hover:bg-slate-100 flex items-center justify-center disabled:opacity-30',
  month_grid: 'w-full border-collapse',
  weekdays: 'flex',
  weekday: 'w-9 text-center text-xs font-medium text-slate-400',
  week: 'flex w-full mt-1',
  day: 'h-9 w-9 text-center text-sm p-0 relative',
  day_button: 'h-9 w-9 rounded-md text-slate-700 hover:bg-primary-50 flex items-center justify-center transition-colors',
  selected: '[&>button]:bg-primary-800 [&>button]:text-white [&>button]:hover:bg-primary-900',
  today: '[&>button]:font-semibold [&>button]:text-primary-700',
  outside: '[&>button]:text-slate-300',
  disabled: '[&>button]:text-slate-300 [&>button]:hover:bg-transparent [&>button]:cursor-not-allowed',
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
  const selected = toDate(value)
  const min = toDate(minDate)
  const max = toDate(maxDate)
  const matcher = []
  if (min) matcher.push({ before: min })
  if (max) matcher.push({ after: max })

  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'flex h-10 w-full items-center justify-between rounded-lg border border-slate-300 bg-white px-3 text-left text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary-500 disabled:cursor-not-allowed disabled:bg-slate-50',
            !selected && 'text-slate-400',
            className
          )}
        >
          <span>{selected ? dayjs(selected).format('MMM D, YYYY') : placeholder}</span>
          <CalendarDays className="h-4 w-4 shrink-0 text-slate-400" />
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content asChild align="start" sideOffset={6}>
          <motion.div {...dropdownMenu} className="z-50 rounded-lg border border-slate-200 bg-white shadow-lg">
            <DayPicker
              mode="single"
              selected={selected}
              defaultMonth={selected}
              onSelect={(date) => onChange(toIso(date))}
              disabled={matcher.length ? matcher : undefined}
              classNames={dayPickerClassNames}
            />
          </motion.div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}
