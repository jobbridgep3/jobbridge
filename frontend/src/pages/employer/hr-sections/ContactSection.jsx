import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card'
import { Input, Label } from '../../../components/ui/Input'
import { RequiredLabel } from '../../../components/ui/RequiredLabel'
import { cn, sanitizeDigits } from '../../../lib/utils'

export function ContactSection({ form, setForm, companyEmail, missingKeys = new Set() }) {
  const err = (key) => cn(missingKeys.has(key) && 'border-red-300 focus:border-red-400')

  return (
    <Card>
      <CardHeader>
        <CardTitle>Contact</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label>Company Email</Label>
          <Input value={companyEmail || ''} disabled />
        </div>
        <div>
          <Label><RequiredLabel label="Personal Email" missing={missingKeys.has('personal_email')} /></Label>
          <Input
            type="email" value={form.personal_email || ''}
            onChange={(e) => setForm((f) => ({ ...f, personal_email: e.target.value }))}
            className={err('personal_email')}
          />
        </div>
        <div>
          <Label><RequiredLabel label="Mobile Number" missing={missingKeys.has('mobile_number')} /></Label>
          <Input
            value={form.mobile_number || ''} inputMode="numeric" maxLength={15}
            onChange={(e) => setForm((f) => ({ ...f, mobile_number: sanitizeDigits(e.target.value) }))}
            className={err('mobile_number')}
          />
        </div>
        <div>
          <Label>Telephone Number</Label>
          <Input
            value={form.telephone_number || ''} inputMode="numeric" maxLength={15}
            onChange={(e) => setForm((f) => ({ ...f, telephone_number: sanitizeDigits(e.target.value) }))}
          />
        </div>
      </CardContent>
    </Card>
  )
}
