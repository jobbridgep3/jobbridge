import { Plus, Trash2 } from 'lucide-react'

import { Button } from '../../../components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card'
import { DatePicker } from '../../../components/ui/DatePicker'
import { Input, Label, Select } from '../../../components/ui/Input'
import { RequiredLabel } from '../../../components/ui/RequiredLabel'
import { cn } from '../../../lib/utils'
import { EMPLOYMENT_STATUSES, EMPLOYMENT_TYPES } from './options'

export function EmploymentInfoSection({ form, setForm, missingKeys = new Set() }) {
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const addWorkExperience = () =>
    setForm((f) => ({ ...f, work_experiences: [...(f.work_experiences || []), { company: '', position: '', start_date: '', end_date: '' }] }))
  const updateWorkExperience = (idx, field, value) =>
    setForm((f) => ({ ...f, work_experiences: f.work_experiences.map((w, i) => (i === idx ? { ...w, [field]: value } : w)) }))
  const removeWorkExperience = (idx) => setForm((f) => ({ ...f, work_experiences: f.work_experiences.filter((_, i) => i !== idx) }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Employment Information</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label><RequiredLabel label="Employment Status" missing={missingKeys.has('employment_status')} /></Label>
            <Select
              value={form.employment_status || ''}
              onChange={set('employment_status')}
              className={cn(missingKeys.has('employment_status') && 'border-red-300 focus:border-red-400')}
            >
              <option value="">Select…</option>
              {EMPLOYMENT_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label><RequiredLabel label="Employment Type Preferred" missing={missingKeys.has('employment_type')} /></Label>
            <Select
              value={form.employment_type || ''}
              onChange={set('employment_type')}
              className={cn(missingKeys.has('employment_type') && 'border-red-300 focus:border-red-400')}
            >
              <option value="">Select…</option>
              {EMPLOYMENT_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label><RequiredLabel label="Preferred Job Position" missing={missingKeys.has('preferred_job_position')} /></Label>
            <Input
              value={form.preferred_job_position || ''}
              onChange={set('preferred_job_position')}
              className={cn(missingKeys.has('preferred_job_position') && 'border-red-300 focus:border-red-400')}
            />
          </div>
          <div>
            <Label><RequiredLabel label="Preferred Industry" missing={missingKeys.has('preferred_industry')} /></Label>
            <Input
              value={form.preferred_industry || ''}
              onChange={set('preferred_industry')}
              className={cn(missingKeys.has('preferred_industry') && 'border-red-300 focus:border-red-400')}
            />
          </div>
          <div>
            <Label><RequiredLabel label="Preferred Work Location" missing={missingKeys.has('preferred_work_location')} /></Label>
            <Input
              value={form.preferred_work_location || ''}
              onChange={set('preferred_work_location')}
              className={cn(missingKeys.has('preferred_work_location') && 'border-red-300 focus:border-red-400')}
            />
          </div>
          <div>
            <Label>Expected Salary (Optional)</Label>
            <Input placeholder="e.g. ₱15,000 or Negotiable" value={form.expected_salary || ''} onChange={set('expected_salary')} />
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-800">Work Experience <span className="font-normal text-slate-400">(optional)</span></h4>
            <Button variant="secondary" size="sm" onClick={addWorkExperience}>
              <Plus className="h-4 w-4" /> Add
            </Button>
          </div>
          <div className="space-y-4">
            {(form.work_experiences || []).map((w, idx) => (
              <div key={idx} className="grid grid-cols-1 gap-3 rounded-lg border border-slate-100 p-3 sm:grid-cols-4">
                <Input placeholder="Company" value={w.company} onChange={(e) => updateWorkExperience(idx, 'company', e.target.value)} />
                <Input placeholder="Position" value={w.position} onChange={(e) => updateWorkExperience(idx, 'position', e.target.value)} />
                <DatePicker
                  placeholder="Start date"
                  value={w.start_date || ''}
                  onChange={(value) => updateWorkExperience(idx, 'start_date', value)}
                  maxDate={w.end_date}
                />
                <div className="flex gap-2">
                  <DatePicker
                    placeholder="End date"
                    value={w.end_date || ''}
                    onChange={(value) => updateWorkExperience(idx, 'end_date', value)}
                    minDate={w.start_date}
                  />
                  <Button variant="ghost" size="icon" onClick={() => removeWorkExperience(idx)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>
            ))}
            {!form.work_experiences?.length && <p className="text-sm text-slate-400">No work experience added yet.</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
