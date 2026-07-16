import dayjs from 'dayjs'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'

import { cn } from '../../lib/utils'
import { Button } from './Button'

/** Event chip colors keyed by interview/application status. */
const STATUS_COLORS = {
  pending: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800',
  accepted: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800',
  declined: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800',
  completed: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800',
  cancelled: 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
  rescheduled: 'bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-900/40 dark:text-violet-300 dark:border-violet-800',
  default: 'bg-primary-50 text-primary-800 border-primary-100 dark:bg-primary-900/40 dark:text-primary-300 dark:border-primary-800',
}

function EventChip({ event, onClick, showTime = true }) {
  const color = STATUS_COLORS[event.status] || STATUS_COLORS.default
  return (
    <button
      type="button"
      onClick={() => onClick?.(event)}
      className={cn('block w-full truncate rounded border px-1.5 py-0.5 text-left text-[11px] font-medium leading-4 hover:opacity-80', color)}
      title={`${event.title}${event.subtitle ? ` — ${event.subtitle}` : ''}`}
    >
      {showTime && <span className="mr-1 opacity-70">{dayjs(event.date).format('h:mma')}</span>}
      {event.title}
    </button>
  )
}

function MonthGrid({ cursor, events, onEventClick, onDayClick }) {
  const start = cursor.startOf('month').startOf('week')
  const days = Array.from({ length: 42 }, (_, i) => start.add(i, 'day'))
  const byDay = useMemo(() => {
    const map = {}
    for (const e of events) {
      const key = dayjs(e.date).format('YYYY-MM-DD')
      ;(map[key] ||= []).push(e)
    }
    return map
  }, [events])

  return (
    <div>
      <div className="grid grid-cols-7 border-b border-border text-center text-xs font-medium text-text-muted">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} className="py-2">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const key = day.format('YYYY-MM-DD')
          const dayEvents = byDay[key] || []
          const isToday = day.isSame(dayjs(), 'day')
          const inMonth = day.isSame(cursor, 'month')
          return (
            <div
              key={key}
              className={cn('min-h-[92px] border-b border-r border-border-subtle p-1', !inMonth && 'bg-surface-secondary/60')}
            >
              <button
                type="button"
                onClick={() => onDayClick?.(day)}
                className={cn(
                  'mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs',
                  isToday ? 'bg-primary-800 font-semibold text-white' : inMonth ? 'text-text-secondary hover:bg-surface-hover' : 'text-text-muted',
                )}
              >
                {day.date()}
              </button>
              <div className="space-y-0.5">
                {dayEvents.slice(0, 3).map((e) => (
                  <EventChip key={e.id} event={e} onClick={onEventClick} showTime={false} />
                ))}
                {dayEvents.length > 3 && (
                  <button type="button" onClick={() => onDayClick?.(day)} className="text-[10px] font-medium text-primary-700 hover:underline">
                    +{dayEvents.length - 3} more
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function WeekGrid({ cursor, events, onEventClick, onDayClick }) {
  const start = cursor.startOf('week')
  const days = Array.from({ length: 7 }, (_, i) => start.add(i, 'day'))
  return (
    <div className="grid grid-cols-7">
      {days.map((day) => {
        const dayEvents = events
          .filter((e) => dayjs(e.date).isSame(day, 'day'))
          .sort((a, b) => dayjs(a.date).valueOf() - dayjs(b.date).valueOf())
        const isToday = day.isSame(dayjs(), 'day')
        return (
          <div key={day.format('YYYY-MM-DD')} className="min-h-[220px] border-r border-border-subtle last:border-r-0">
            <button
              type="button"
              onClick={() => onDayClick?.(day)}
              className={cn(
                'flex w-full flex-col items-center border-b border-border py-2 hover:bg-surface-hover',
                isToday && 'bg-primary-50 dark:bg-primary-900/30',
              )}
            >
              <span className="text-xs text-text-muted">{day.format('ddd')}</span>
              <span className={cn('text-sm font-semibold', isToday ? 'text-primary-800 dark:text-primary-300' : 'text-text-secondary')}>{day.format('D')}</span>
            </button>
            <div className="space-y-1 p-1.5">
              {dayEvents.map((e) => (
                <EventChip key={e.id} event={e} onClick={onEventClick} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function DayList({ cursor, events, onEventClick }) {
  const dayEvents = events
    .filter((e) => dayjs(e.date).isSame(cursor, 'day'))
    .sort((a, b) => dayjs(a.date).valueOf() - dayjs(b.date).valueOf())
  if (!dayEvents.length) {
    return <p className="py-12 text-center text-sm text-text-muted">Nothing scheduled on {cursor.format('MMMM D, YYYY')}.</p>
  }
  return (
    <div className="divide-y divide-border-subtle">
      {dayEvents.map((e) => {
        const color = STATUS_COLORS[e.status] || STATUS_COLORS.default
        return (
          <button
            key={e.id}
            type="button"
            onClick={() => onEventClick?.(e)}
            className="flex w-full items-center gap-4 px-3 py-3 text-left hover:bg-surface-hover"
          >
            <div className="w-20 shrink-0 text-sm font-semibold text-text-secondary">{dayjs(e.date).format('h:mm A')}</div>
            <span className={cn('h-8 w-1 shrink-0 rounded-full border', color)} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-text-primary">{e.title}</p>
              {e.subtitle && <p className="truncate text-xs text-text-muted">{e.subtitle}</p>}
            </div>
            <span className={cn('ml-auto shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize', color)}>{e.status}</span>
          </button>
        )
      })}
    </div>
  )
}

/**
 * Month/Week/Day calendar for schedule-style pages.
 * `events`: [{ id, date (ISO datetime), title, subtitle?, status?, meta? }]
 */
export function CalendarView({ events = [], onEventClick, initialView = 'month' }) {
  const [view, setView] = useState(initialView)
  const [cursor, setCursor] = useState(dayjs())

  const step = view === 'month' ? 'month' : view === 'week' ? 'week' : 'day'
  const label =
    view === 'month'
      ? cursor.format('MMMM YYYY')
      : view === 'week'
        ? `${cursor.startOf('week').format('MMM D')} – ${cursor.endOf('week').format('MMM D, YYYY')}`
        : cursor.format('dddd, MMMM D, YYYY')

  const openDay = (day) => {
    setCursor(day)
    setView('day')
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-3">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => setCursor(cursor.subtract(1, step))} aria-label="Previous">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setCursor(cursor.add(1, step))} aria-label="Next">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setCursor(dayjs())}>
            Today
          </Button>
          <h3 className="ml-2 text-sm font-semibold text-text-primary">{label}</h3>
        </div>
        <div className="flex rounded-lg border border-border p-0.5">
          {['month', 'week', 'day'].map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={cn(
                'rounded-md px-3 py-1 text-xs font-medium capitalize',
                view === v ? 'bg-primary-800 text-white' : 'text-text-secondary hover:bg-surface-hover',
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>
      {view === 'month' && <MonthGrid cursor={cursor} events={events} onEventClick={onEventClick} onDayClick={openDay} />}
      {view === 'week' && <WeekGrid cursor={cursor} events={events} onEventClick={onEventClick} onDayClick={openDay} />}
      {view === 'day' && <DayList cursor={cursor} events={events} onEventClick={onEventClick} />}
    </div>
  )
}
