import { useState } from 'react'

import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card'
import { Input, Label, Select } from '../../../components/ui/Input'
import { RequiredLabel } from '../../../components/ui/RequiredLabel'
import { cn } from '../../../lib/utils'
import { EMPLOYMENT_TYPES_OFFERED, HIRING_STATUSES, WORK_SETUPS } from './options'

function CheckboxGroup({ options, values, onToggle }) {
  return (
    <div className="flex flex-wrap gap-3">
      {options.map((opt) => (
        <label key={opt.value} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:border-primary-300">
          <input type="checkbox" checked={values.includes(opt.value)} onChange={() => onToggle(opt.value)} className="rounded border-slate-300 text-primary-600" />
          {opt.label}
        </label>
      ))}
    </div>
  )
}

export function EmploymentInfoSection({ form, setForm, missingKeys = new Set() }) {
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))
  const err = (key) => cn(missingKeys.has(key) && 'border-red-300 focus:border-red-400')

  const toggle = (field) => (value) => setForm((f) => {
    const current = f[field] || []
    return { ...f, [field]: current.includes(value) ? current.filter((v) => v !== value) : [...current, value] }
  })

  const [hiringAreaInput, setHiringAreaInput] = useState('')

  const addHiringArea = () => {
    const value = hiringAreaInput.trim()
    if (!value) return
    setForm((f) => ({ ...f, preferred_hiring_areas: [...(f.preferred_hiring_areas || []), value] }))
    setHiringAreaInput('')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Employment Information</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label><RequiredLabel label="Hiring Status" missing={missingKeys.has('hiring_status')} /></Label>
            <Select value={form.hiring_status || ''} onChange={set('hiring_status')} className={err('hiring_status')}>
              <option value="">Select…</option>
              {HIRING_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Active Vacancies</Label>
            <Input value={form.active_vacancies ?? 0} disabled />
          </div>
        </div>

        <div>
          <Label>Preferred Hiring Areas</Label>
          <div className="mb-2 flex flex-wrap gap-2">
            {(form.preferred_hiring_areas || []).map((area, i) => (
              <span key={`${area}-${i}`} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-700">
                {area}
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, preferred_hiring_areas: f.preferred_hiring_areas.filter((_, idx) => idx !== i) }))}
                  className="text-slate-400 hover:text-red-500"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={hiringAreaInput}
              onChange={(e) => setHiringAreaInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addHiringArea() } }}
              placeholder="e.g. Quezon City — press Enter to add"
            />
          </div>
        </div>

        <div>
          <Label><RequiredLabel label="Work Setup" missing={missingKeys.has('work_setup')} /></Label>
          <CheckboxGroup options={WORK_SETUPS} values={form.work_setup || []} onToggle={toggle('work_setup')} />
        </div>

        <div>
          <Label><RequiredLabel label="Employment Types Offered" missing={missingKeys.has('employment_types_offered')} /></Label>
          <CheckboxGroup options={EMPLOYMENT_TYPES_OFFERED} values={form.employment_types_offered || []} onToggle={toggle('employment_types_offered')} />
        </div>
      </CardContent>
    </Card>
  )
}
