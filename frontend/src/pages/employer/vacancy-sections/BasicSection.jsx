import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card'
import { Input, Label, Select } from '../../../components/ui/Input'
import { RequiredLabel } from '../../../components/ui/RequiredLabel'
import { EMPLOYMENT_TYPES, WORK_ARRANGEMENTS } from './options'

export function BasicSection({ form, setForm, categories = [], missingKeys = new Set() }) {
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

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
        <div>
          <Label>Schedule</Label>
          <Input value={form.schedule || ''} onChange={set('schedule')} placeholder="e.g. Mon-Fri, 9AM-6PM" />
        </div>
      </CardContent>
    </Card>
  )
}
