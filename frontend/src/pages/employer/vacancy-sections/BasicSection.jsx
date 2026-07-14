import { useEffect, useRef, useState } from 'react'

import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card'
import { Input, Label, Select } from '../../../components/ui/Input'
import { RequiredLabel } from '../../../components/ui/RequiredLabel'
import { TimePicker } from '../../../components/ui/TimePicker'
import { EMPLOYMENT_TYPES, WORK_ARRANGEMENTS } from './options'

const SCHEDULE_RE = /^(\d{1,2}:\d{2}\s*[AP]M)\s*-\s*(\d{1,2}:\d{2}\s*[AP]M)$/i

/** Best-effort split of a "9:00 AM - 6:00 PM" schedule string into its two
 * TimePicker values. Legacy free-text schedules (e.g. "Rotating shifts")
 * simply don't match and leave both pickers blank for re-entry. */
function splitSchedule(schedule) {
  const match = SCHEDULE_RE.exec((schedule || '').trim())
  return match ? { start: match[1].toUpperCase(), end: match[2].toUpperCase() } : { start: '', end: '' }
}

function joinSchedule(start, end) {
  if (!start || !end) return start || end || ''
  return `${start} - ${end}`
}

/** "9:00 AM" -> minutes since midnight, for comparing Start/End Time. */
function timeToMinutes(value) {
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec((value || '').trim())
  if (!match) return null
  let hour = Number(match[1]) % 12
  if (match[3].toUpperCase() === 'PM') hour += 12
  return hour * 60 + Number(match[2])
}

export function BasicSection({ form, setForm, categories = [], missingKeys = new Set() }) {
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  // Local state for the two TimePickers, seeded once from the saved schedule
  // string (so editing an existing vacancy loads it correctly). Deliberately
  // NOT re-derived from form.schedule on every render — joining a single
  // updated side back into "form.schedule" and re-splitting it on the next
  // render would fail to parse while the other side is still unset, wiping
  // the just-picked value back to blank and making the pickers feel dead.
  const [scheduleStart, setScheduleStart] = useState('')
  const [scheduleEnd, setScheduleEnd] = useState('')
  const scheduleInitializedRef = useRef(false)
  useEffect(() => {
    if (form.schedule !== undefined && !scheduleInitializedRef.current) {
      const { start, end } = splitSchedule(form.schedule)
      setScheduleStart(start)
      setScheduleEnd(end)
      scheduleInitializedRef.current = true
    }
  }, [form.schedule])

  const updateSchedule = (start, end) => setForm((f) => ({ ...f, schedule: joinSchedule(start, end) }))
  const startMinutes = timeToMinutes(scheduleStart)
  const endMinutes = timeToMinutes(scheduleEnd)
  const scheduleInvalid = startMinutes != null && endMinutes != null && startMinutes >= endMinutes

  return (
    <Card>
      <CardHeader>
        <CardTitle>Basic Information</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label><RequiredLabel label="Job Title" missing={missingKeys.has('title')} /></Label>
          <Input value={form.title || ''} onChange={set('title')} />
        </div>
        <div>
          <Label>Category</Label>
          <Select value={form.category_id || ''} onChange={set('category_id')}>
            <option value="">Select…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Industry</Label>
          <Input value={form.industry || ''} onChange={set('industry')} />
        </div>
        <div>
          <Label>Department</Label>
          <Input value={form.department || ''} onChange={set('department')} />
        </div>
        <div>
          <Label>Vacancy No.</Label>
          <Input value={form.vacancy_no || ''} onChange={set('vacancy_no')} />
        </div>
        <div>
          <Label>Openings</Label>
          <Input type="number" min={1} value={form.num_slots || 1} onChange={set('num_slots')} />
        </div>
        <div>
          <Label>Employment Type</Label>
          <Select value={form.job_type || ''} onChange={set('job_type')}>
            <option value="">Select…</option>
            {EMPLOYMENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Work Arrangement</Label>
          <Select value={form.work_arrangement || ''} onChange={set('work_arrangement')}>
            <option value="">Select…</option>
            {WORK_ARRANGEMENTS.map((w) => (
              <option key={w.value} value={w.value}>{w.label}</option>
            ))}
          </Select>
        </div>
        <div className="sm:col-span-2">
          <Label>Schedule</Label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-normal text-slate-500">Start Time</Label>
              <TimePicker
                value={scheduleStart}
                onChange={(start) => {
                  setScheduleStart(start)
                  updateSchedule(start, scheduleEnd)
                }}
                className={scheduleInvalid ? 'border-red-300 focus-visible:outline-red-400' : undefined}
              />
            </div>
            <div>
              <Label className="text-xs font-normal text-slate-500">End Time</Label>
              <TimePicker
                value={scheduleEnd}
                onChange={(end) => {
                  setScheduleEnd(end)
                  updateSchedule(scheduleStart, end)
                }}
                className={scheduleInvalid ? 'border-red-300 focus-visible:outline-red-400' : undefined}
              />
            </div>
          </div>
          {scheduleInvalid && <p className="mt-1 text-xs text-red-600">Start Time must be earlier than End Time.</p>}
        </div>
      </CardContent>
    </Card>
  )
}
