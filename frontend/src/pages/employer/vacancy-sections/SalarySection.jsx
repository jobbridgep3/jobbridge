import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card'
import { Input, Label } from '../../../components/ui/Input'
import { formatSalaryRange } from '../../../lib/salaryFormat'
import { BENEFITS_CHECKLIST } from './options'

export function SalarySection({ form, setForm }) {
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const toggleBenefit = (benefit) => {
    const current = form.benefits || []
    setForm((f) => ({
      ...f,
      benefits: current.includes(benefit) ? current.filter((b) => b !== benefit) : [...current, benefit],
    }))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Salary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox" checked={form.hide_salary || false}
            onChange={(e) => setForm((f) => ({ ...f, hide_salary: e.target.checked }))}
            className="rounded border-slate-300 text-primary-600"
          />
          Hide Salary (show "Negotiable" / "Salary not disclosed" instead of a range)
        </label>

        {!form.hide_salary && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label>Salary Min</Label>
              <Input type="number" value={form.salary_min ?? ''} onChange={set('salary_min')} />
            </div>
            <div>
              <Label>Salary Max</Label>
              <Input type="number" value={form.salary_max ?? ''} onChange={set('salary_max')} />
            </div>
          </div>
        )}
        <p className="text-sm text-slate-500">
          Preview: <span className="font-medium text-slate-700">{formatSalaryRange(form.salary_min, form.salary_max, form.hide_salary)}</span>
        </p>

        <div>
          <Label>Benefits</Label>
          <div className="flex flex-wrap gap-3">
            {BENEFITS_CHECKLIST.map((b) => (
              <label key={b} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:border-primary-300">
                <input type="checkbox" checked={(form.benefits || []).includes(b)} onChange={() => toggleBenefit(b)} className="rounded border-slate-300 text-primary-600" />
                {b}
              </label>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
