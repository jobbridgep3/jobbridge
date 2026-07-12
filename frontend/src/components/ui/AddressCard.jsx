import { AddressCascadeSelect } from './AddressCascadeSelect'
import { Card, CardContent, CardHeader, CardTitle } from './Card'

/** Thin Card wrapper around AddressCascadeSelect, shared by Company Profile, HR
 * Profile, and (Phase 6) Vacancy Location — avoids each page re-declaring the same
 * Card/CardHeader/CardTitle scaffolding around the picker. */
export function AddressCard({ title = 'Address', form, setForm, missingKeys = new Set() }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <AddressCascadeSelect value={form} onChange={(next) => setForm((f) => ({ ...f, ...next }))} missingKeys={missingKeys} />
      </CardContent>
    </Card>
  )
}
