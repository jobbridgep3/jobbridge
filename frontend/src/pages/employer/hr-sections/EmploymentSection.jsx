import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card'
import { Input, Label, Select } from '../../../components/ui/Input'
import { RequiredLabel } from '../../../components/ui/RequiredLabel'
import { cn } from '../../../lib/utils'
import { EMPLOYMENT_STATUSES, HR_ROLES } from './options'

export function EmploymentSection({ form, setForm, missingKeys = new Set() }) {
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))
  const err = (key) => cn(missingKeys.has(key) && 'border-red-300 focus:border-red-400')

  return (
    <Card>
      <CardHeader>
        <CardTitle>Employment</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label>Company Name</Label>
          <Input value={form.company_name || ''} disabled />
        </div>
        <div>
          <Label><RequiredLabel label="Employee ID" missing={missingKeys.has('employee_id')} /></Label>
          <Input value={form.employee_id || ''} onChange={set('employee_id')} className={err('employee_id')} />
        </div>
        <div>
          <Label><RequiredLabel label="Department" missing={missingKeys.has('department')} /></Label>
          <Input value={form.department || ''} onChange={set('department')} className={err('department')} />
        </div>
        <div>
          <Label><RequiredLabel label="Position" missing={missingKeys.has('position')} /></Label>
          <Input value={form.position || ''} onChange={set('position')} className={err('position')} />
        </div>
        <div>
          <Label><RequiredLabel label="Employment Status" missing={missingKeys.has('employment_status')} /></Label>
          <Select value={form.employment_status || ''} onChange={set('employment_status')} className={err('employment_status')}>
            <option value="">Select…</option>
            {EMPLOYMENT_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label><RequiredLabel label="HR Role" missing={missingKeys.has('hr_role')} /></Label>
          <Select value={form.hr_role || ''} onChange={set('hr_role')} className={err('hr_role')}>
            <option value="">Select…</option>
            {HR_ROLES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </Select>
        </div>
      </CardContent>
    </Card>
  )
}
