import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card'
import { Label, Textarea } from '../../../components/ui/Input'

export function AdditionalInfoSection({ form, setForm }) {
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Additional Information</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Company Culture</Label>
          <Textarea rows={3} value={form.culture_description || ''} onChange={set('culture_description')} />
        </div>
        <div>
          <Label>Career Growth</Label>
          <Textarea rows={3} value={form.career_growth_description || ''} onChange={set('career_growth_description')} />
        </div>
        <div>
          <Label>Additional Notes</Label>
          <Textarea rows={3} value={form.additional_notes || ''} onChange={set('additional_notes')} />
        </div>
      </CardContent>
    </Card>
  )
}
