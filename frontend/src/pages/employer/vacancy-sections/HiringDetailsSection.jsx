import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card'
import { Input, Label } from '../../../components/ui/Input'

export function HiringDetailsSection({ form, setForm }) {
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Hiring Details</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <Label>Posting Date</Label>
          <Input type="date" value={form.posting_date || ''} onChange={set('posting_date')} />
        </div>
        <div>
          <Label>Application Deadline</Label>
          <Input type="date" value={form.application_deadline || ''} onChange={set('application_deadline')} />
        </div>
        <div>
          <Label>Expected Start Date</Label>
          <Input type="date" value={form.expected_start_date || ''} onChange={set('expected_start_date')} />
        </div>
      </CardContent>
    </Card>
  )
}
