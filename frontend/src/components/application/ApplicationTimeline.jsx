import dayjs from 'dayjs'

/** Vertical status-history stepper shared by the jobseeker application detail and
 * the employer applicant detail. `events` come from the backend build_timeline(). */
export function ApplicationTimeline({ events }) {
  if (!events?.length) return <p className="text-sm text-slate-500">No timeline history yet.</p>
  return (
    <ol className="relative ml-2 space-y-4 border-l border-slate-200 pl-5">
      {events.map((event, i) => {
        const isLast = i === events.length - 1
        return (
          <li key={event.id || i} className="relative">
            <span
              className={`absolute -left-[26.5px] top-1 h-3 w-3 rounded-full border-2 ${
                isLast ? 'border-primary-600 bg-primary-600' : 'border-slate-300 bg-white'
              }`}
            />
            <p className={`text-sm font-medium ${isLast ? 'text-primary-700' : 'text-slate-700'}`}>{event.to_status_label}</p>
            <p className="text-xs text-slate-500">
              {event.created_at ? dayjs(event.created_at).format('MMM D, YYYY h:mm A') : ''}
              {event.changed_by_role && event.changed_by_role !== 'system' ? ` · by ${event.changed_by_role}` : ''}
            </p>
            {event.note && <p className="mt-0.5 text-xs italic text-slate-500">"{event.note}"</p>}
          </li>
        )
      })}
    </ol>
  )
}
