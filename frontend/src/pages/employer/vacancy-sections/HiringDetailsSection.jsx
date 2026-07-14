import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card'
import { DatePicker } from '../../../components/ui/DatePicker'
import { Label } from '../../../components/ui/Input'

export function HiringDetailsSection({ form, setForm }) {
  const set = (field) => (value) => setForm((f) => ({ ...f, [field]: value }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Hiring Details</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <Label>Posting Date</Label>
          <DatePicker value={form.posting_date || ''} onChange={set('posting_date')} maxDate={form.application_deadline} />
        </div>
        <div>
          <Label>Application Deadline</Label>
          <DatePicker
            value={form.application_deadline || ''}
            onChange={set('application_deadline')}
            minDate={form.posting_date}
            maxDate={form.expected_start_date}
          />
        </div>
        <div>
          <Label>Expected Start Date</Label>
          <DatePicker value={form.expected_start_date || ''} onChange={set('expected_start_date')} minDate={form.application_deadline || form.posting_date} />
        </div>
      </CardContent>
    </Card>
  )
}
