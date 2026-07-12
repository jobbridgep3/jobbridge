import { Building2 } from 'lucide-react'
import { useDropzone } from 'react-dropzone'

import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card'
import { Input, Label, Select, Textarea } from '../../../components/ui/Input'
import { RequiredLabel } from '../../../components/ui/RequiredLabel'
import { cn, sanitizeDigits } from '../../../lib/utils'
import { BUSINESS_TYPES, COMPANY_SIZES } from './options'

export function BasicInfoSection({ form, setForm, onUploadLogo, uploadingLogo, missingKeys = new Set() }) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'image/*': [] },
    maxFiles: 1,
    disabled: uploadingLogo,
    onDrop: (accepted) => {
      if (accepted.length) onUploadLogo(accepted[0])
    },
  })

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))
  const err = (key) => cn(missingKeys.has(key) && 'border-red-300 focus:border-red-400')

  return (
    <Card>
      <CardHeader>
        <CardTitle>Basic Information</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2 flex items-center gap-4">
          <div
            {...getRootProps()}
            className={`flex h-16 w-16 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg border-2 border-dashed text-slate-400 ${
              isDragActive ? 'border-primary-400 bg-primary-50' : 'border-slate-200 hover:border-primary-300'
            }`}
          >
            <input {...getInputProps()} />
            {form.logo_url ? <img src={form.logo_url} alt="Company logo" className="h-full w-full object-cover" /> : <Building2 className="h-6 w-6" />}
          </div>
          <div>
            <p className="text-sm font-medium text-slate-700">
              <RequiredLabel label="Company Logo" missing={missingKeys.has('company_logo')} />
            </p>
            <p className="text-xs text-slate-400">{uploadingLogo ? 'Uploading…' : 'Click or drag an image to upload'}</p>
          </div>
        </div>

        <div>
          <Label><RequiredLabel label="Company Name" missing={missingKeys.has('company_name')} /></Label>
          <Input value={form.company_name || ''} onChange={set('company_name')} className={err('company_name')} />
        </div>
        <div>
          <Label>Trade Name</Label>
          <Input value={form.trade_name || ''} onChange={set('trade_name')} />
        </div>
        <div>
          <Label><RequiredLabel label="Business Type" missing={missingKeys.has('business_type')} /></Label>
          <Select value={form.business_type || ''} onChange={set('business_type')} className={err('business_type')}>
            <option value="">Select…</option>
            {BUSINESS_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label><RequiredLabel label="Industry" missing={missingKeys.has('industry')} /></Label>
          <Input value={form.industry || ''} onChange={set('industry')} className={err('industry')} />
        </div>
        <div className="sm:col-span-2">
          <Label>Nature of Business</Label>
          <Input value={form.nature_of_business || ''} onChange={set('nature_of_business')} />
        </div>
        <div className="sm:col-span-2">
          <Label><RequiredLabel label="About Company" missing={missingKeys.has('description')} /></Label>
          <Textarea rows={4} value={form.description || ''} onChange={set('description')} className={err('description')} />
        </div>
        <div>
          <Label><RequiredLabel label="Year Established" missing={missingKeys.has('year_established')} /></Label>
          <Input
            type="number" min="1900" max={new Date().getFullYear()}
            value={form.year_established || ''} onChange={set('year_established')} className={err('year_established')}
          />
        </div>
        <div>
          <Label><RequiredLabel label="Number of Employees" missing={missingKeys.has('num_employees')} /></Label>
          <Input type="number" min="0" value={form.num_employees || ''} onChange={set('num_employees')} className={err('num_employees')} />
        </div>
        <div>
          <Label><RequiredLabel label="Company Size" missing={missingKeys.has('company_size')} /></Label>
          <Select value={form.company_size || ''} onChange={set('company_size')} className={err('company_size')}>
            <option value="">Select…</option>
            {COMPANY_SIZES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Website</Label>
          <Input value={form.website || ''} onChange={set('website')} placeholder="https://" />
        </div>
        <div>
          <Label><RequiredLabel label="Company Email" missing={missingKeys.has('company_email')} /></Label>
          <Input type="email" value={form.company_email || ''} onChange={set('company_email')} className={err('company_email')} />
        </div>
        <div>
          <Label><RequiredLabel label="Contact Number" missing={missingKeys.has('contact_number')} /></Label>
          <Input
            value={form.contact_number || ''} inputMode="numeric" maxLength={15}
            onChange={(e) => setForm((f) => ({ ...f, contact_number: sanitizeDigits(e.target.value) }))}
            className={err('contact_number')}
          />
        </div>
        <div>
          <Label>Alternative Contact Number</Label>
          <Input
            value={form.alt_contact_number || ''} inputMode="numeric" maxLength={15}
            onChange={(e) => setForm((f) => ({ ...f, alt_contact_number: sanitizeDigits(e.target.value) }))}
          />
        </div>
      </CardContent>
    </Card>
  )
}
