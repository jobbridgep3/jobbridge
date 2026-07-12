import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card'
import { Input, Label } from '../../../components/ui/Input'
import { sanitizeDigits } from '../../../lib/utils'

export function EmergencyContactSection({ form, setForm }) {
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Emergency Contact</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label>Name</Label>
          <Input value={form.emergency_contact_name || ''} onChange={set('emergency_contact_name')} />
        </div>
        <div>
          <Label>Relationship</Label>
          <Input value={form.emergency_contact_relationship || ''} onChange={set('emergency_contact_relationship')} />
        </div>
        <div>
          <Label>Contact Number</Label>
          <Input
            value={form.emergency_contact_number || ''} inputMode="numeric" maxLength={15}
            onChange={(e) => setForm((f) => ({ ...f, emergency_contact_number: sanitizeDigits(e.target.value) }))}
          />
        </div>
      </CardContent>
    </Card>
  )
}
