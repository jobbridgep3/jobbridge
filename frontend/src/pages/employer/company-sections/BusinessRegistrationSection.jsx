import { CollapsibleCard } from '../../../components/ui/CollapsibleCard'
import { Input, Label } from '../../../components/ui/Input'
import { RequiredLabel } from '../../../components/ui/RequiredLabel'
import { cn } from '../../../lib/utils'
import { BUSINESS_TYPE_REGISTRATION_FIELD } from './options'

export function BusinessRegistrationSection({ form, setForm, missingKeys = new Set(), open, onToggle }) {
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))
  const err = (key) => cn(missingKeys.has(key) && 'border-red-300 focus:border-red-400')
  const registrationField = BUSINESS_TYPE_REGISTRATION_FIELD[form.business_type]

  return (
    <CollapsibleCard title="Business Registration" open={open} onToggle={onToggle} contentClassName="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label><RequiredLabel label="Business Permit Number" missing={missingKeys.has('business_permit_no')} /></Label>
          <Input value={form.business_permit_no || ''} onChange={set('business_permit_no')} className={err('business_permit_no')} />
        </div>
        <div>
          <Label><RequiredLabel label="BIR TIN" missing={missingKeys.has('bir_tin')} /></Label>
          <Input value={form.bir_tin || ''} onChange={set('bir_tin')} className={err('bir_tin')} />
        </div>
        {registrationField ? (
          <div>
            <Label><RequiredLabel label={registrationField.label} missing={missingKeys.has('registration_number')} /></Label>
            <Input
              value={form[registrationField.field] || ''}
              onChange={set(registrationField.field)}
              className={err('registration_number')}
            />
          </div>
        ) : (
          <div>
            <Label>SEC / DTI / CDA Number</Label>
            <Input disabled placeholder="Select a Business Type above first" />
          </div>
        )}
        <div>
          <Label>PhilGEPS Registration Number</Label>
          <Input value={form.philgeps_registration_no || ''} onChange={set('philgeps_registration_no')} />
        </div>
    </CollapsibleCard>
  )
}
