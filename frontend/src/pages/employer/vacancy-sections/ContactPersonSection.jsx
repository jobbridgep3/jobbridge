import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card'
import { Input, Label } from '../../../components/ui/Input'
import { sanitizeDigits } from '../../../lib/utils'

export function ContactPersonSection({ form, setForm }) {
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Contact Person</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <Label>HR Name</Label>
          <Input value={form.contact_name || ''} onChange={set('contact_name')} />
        </div>
        <div>
          <Label>Email</Label>
          <Input type="email" value={form.contact_email || ''} onChange={set('contact_email')} />
        </div>
        <div>
          <Label>Contact Number</Label>
          <Input
            value={form.contact_number || ''} inputMode="numeric" maxLength={15}
            onChange={(e) => setForm((f) => ({ ...f, contact_number: sanitizeDigits(e.target.value) }))}
          />
        </div>
      </CardContent>
    </Card>
  )
}
