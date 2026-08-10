import { UserRound } from 'lucide-react'
import { useDropzone } from 'react-dropzone'

import { CollapsibleCard } from '../../../components/ui/CollapsibleCard'
import { DatePicker } from '../../../components/ui/DatePicker'
import { Input, Label, Select } from '../../../components/ui/Input'
import { RequiredLabel } from '../../../components/ui/RequiredLabel'
import { cn, sanitizeDigits } from '../../../lib/utils'
import { CIVIL_STATUSES, GENDERS } from './options'

const HIGHLIGHT_CLASS = 'border-emerald-300 bg-emerald-50 focus:border-emerald-400'

export function PersonalInfoSection({
  form, setForm, onUploadPicture, uploadingPicture, missingKeys = new Set(), highlightedFields = new Set(), clearHighlight, open, onToggle,
}) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'image/*': [] },
    maxFiles: 1,
    disabled: uploadingPicture || !onUploadPicture,
    onDrop: (accepted) => {
      if (accepted.length && onUploadPicture) onUploadPicture(accepted[0])
    },
  })

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))
  const onBlur = (field) => () => clearHighlight?.(field)
  const fieldClass = (field) => cn(missingKeys.has(field) && 'border-red-300 focus:border-red-400', highlightedFields.has(field) && HIGHLIGHT_CLASS)

  return (
    <CollapsibleCard title="Personal Information" open={open} onToggle={onToggle} contentClassName="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2 flex items-center gap-4">
          <div
            {...(onUploadPicture ? getRootProps() : {})}
            className={`flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-dashed text-slate-400 ${
              onUploadPicture ? 'cursor-pointer' : ''
            } ${isDragActive ? 'border-primary-400 bg-primary-50' : 'border-slate-200 hover:border-primary-300'}`}
          >
            {onUploadPicture && <input {...getInputProps()} />}
            {form.profile_picture_url ? (
              <img src={form.profile_picture_url} alt="Profile" className="h-full w-full object-cover" />
            ) : (
              <UserRound className="h-6 w-6" />
            )}
          </div>
          {onUploadPicture && (
            <div>
              <p className="text-sm font-medium text-slate-700">Profile Picture</p>
              <p className="text-xs text-slate-400">{uploadingPicture ? 'Uploading…' : 'Click or drag an image to upload'}</p>
            </div>
          )}
        </div>

        <div>
          <Label><RequiredLabel label="Full Name" missing={missingKeys.has('full_name')} /></Label>
          <Input value={form.full_name || ''} onChange={set('full_name')} onBlur={onBlur('full_name')} className={fieldClass('full_name')} />
        </div>
        <div>
          <Label>Email Address</Label>
          <Input value={form.email || ''} disabled />
        </div>
        <div>
          <Label><RequiredLabel label="Contact Number" missing={missingKeys.has('contact_number')} /></Label>
          <Input
            value={form.contact_number || ''}
            inputMode="numeric"
            maxLength={15}
            onChange={(e) => setForm((f) => ({ ...f, contact_number: sanitizeDigits(e.target.value) }))}
            onBlur={onBlur('contact_number')}
            className={fieldClass('contact_number')}
          />
        </div>
        <div>
          <Label><RequiredLabel label="Date of Birth" missing={missingKeys.has('date_of_birth')} /></Label>
          <div className="flex items-center gap-2">
            <DatePicker
              value={form.date_of_birth || ''}
              onChange={(value) => {
                setForm((f) => ({ ...f, date_of_birth: value }))
                clearHighlight?.('date_of_birth')
              }}
              maxDate={new Date().toISOString().slice(0, 10)}
              className={fieldClass('date_of_birth')}
            />
            {form.age != null && <span className="whitespace-nowrap text-xs text-slate-400">{form.age} yrs old</span>}
          </div>
        </div>
        <div>
          <Label><RequiredLabel label="Gender" missing={missingKeys.has('gender')} /></Label>
          <Select value={form.gender || ''} onChange={set('gender')} onBlur={onBlur('gender')} className={fieldClass('gender')}>
            <option value="">Select…</option>
            {GENDERS.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label><RequiredLabel label="Civil Status" missing={missingKeys.has('civil_status')} /></Label>
          <Select value={form.civil_status || ''} onChange={set('civil_status')} onBlur={onBlur('civil_status')} className={fieldClass('civil_status')}>
            <option value="">Select…</option>
            {CIVIL_STATUSES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label><RequiredLabel label="Nationality" missing={missingKeys.has('nationality')} /></Label>
          <Input value={form.nationality || ''} onChange={set('nationality')} onBlur={onBlur('nationality')} className={fieldClass('nationality')} />
        </div>
        <div>
          <Label><RequiredLabel label="Barangay" missing={missingKeys.has('barangay')} /></Label>
          <Input value={form.barangay || ''} onChange={set('barangay')} onBlur={onBlur('barangay')} className={fieldClass('barangay')} />
        </div>
        <div>
          <Label><RequiredLabel label="Municipality" missing={missingKeys.has('municipality')} /></Label>
          <Input value={form.municipality || ''} onChange={set('municipality')} onBlur={onBlur('municipality')} className={fieldClass('municipality')} />
        </div>
        <div>
          <Label><RequiredLabel label="Province" missing={missingKeys.has('province')} /></Label>
          <Input value={form.province || ''} onChange={set('province')} onBlur={onBlur('province')} className={fieldClass('province')} />
        </div>
        <div>
          <Label>Region</Label>
          <Input
            value={form.region_name || ''}
            onChange={set('region_name')}
            onBlur={onBlur('region_name')}
            placeholder="e.g. Region IV-A (CALABARZON)"
            className={fieldClass('region_name')}
          />
        </div>
        <div>
          <Label>ZIP Code</Label>
          <Input value={form.zip_code || ''} onChange={set('zip_code')} onBlur={onBlur('zip_code')} placeholder="e.g. 4000" className={fieldClass('zip_code')} />
        </div>
    </CollapsibleCard>
  )
}
