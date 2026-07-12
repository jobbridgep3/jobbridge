import { AddressCascadeSelect } from '../../../components/ui/AddressCascadeSelect'
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card'

export function AddressSection({ form, setForm, missingKeys = new Set() }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Company Address</CardTitle>
      </CardHeader>
      <CardContent>
        <AddressCascadeSelect value={form} onChange={(next) => setForm((f) => ({ ...f, ...next }))} missingKeys={missingKeys} />
      </CardContent>
    </Card>
  )
}
