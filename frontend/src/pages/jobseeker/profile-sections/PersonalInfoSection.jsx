import { UserRound } from 'lucide-react'
import { useDropzone } from 'react-dropzone'

import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card'
import { Input, Label, Select } from '../../../components/ui/Input'
import { RequiredLabel } from '../../../components/ui/RequiredLabel'
import { cn, sanitizeDigits } from '../../../lib/utils'
import { CIVIL_STATUSES, GENDERS } from './options'

export function PersonalInfoSection({ form, setForm, onUploadPicture, uploadingPicture, missingKeys = new Set() }) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'image/*': [] },
    maxFiles: 1,
    disabled: uploadingPicture || !onUploadPicture,
    onDrop: (accepted) => {
      if (accepted.length && onUploadPicture) onUploadPicture(accepted[0])
    },
  })

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Personal Information</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
          <Input
            value={form.full_name || ''}
            onChange={set('full_name')}
            className={cn(missingKeys.has('full_name') && 'border-red-300 focus:border-red-400')}
          />
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
            className={cn(missingKeys.has('contact_number') && 'border-red-300 focus:border-red-400')}
          />
        </div>
        <div>
          <Label><RequiredLabel label="Date of Birth" missing={missingKeys.has('date_of_birth')} /></Label>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={form.date_of_birth || ''}
              onChange={set('date_of_birth')}
              className={cn(missingKeys.has('date_of_birth') && 'border-red-300 focus:border-red-400')}
            />
            {form.age != null && <span className="whitespace-nowrap text-xs text-slate-400">{form.age} yrs old</span>}
          </div>
        </div>
        <div>
          <Label><RequiredLabel label="Gender" missing={missingKeys.has('gender')} /></Label>
          <Select
            value={form.gender || ''}
            onChange={set('gender')}
            className={cn(missingKeys.has('gender') && 'border-red-300 focus:border-red-400')}
          >
            <option value="">Select…</option>
            {GENDERS.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label><RequiredLabel label="Civil Status" missing={missingKeys.has('civil_status')} /></Label>
          <Select
            value={form.civil_status || ''}
            onChange={set('civil_status')}
            className={cn(missingKeys.has('civil_status') && 'border-red-300 focus:border-red-400')}
          >
            <option value="">Select…</option>
            {CIVIL_STATUSES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label><RequiredLabel label="Nationality" missing={missingKeys.has('nationality')} /></Label>
          <Input
            value={form.nationality || ''}
            onChange={set('nationality')}
            className={cn(missingKeys.has('nationality') && 'border-red-300 focus:border-red-400')}
          />
        </div>
        <div>
          <Label><RequiredLabel label="Barangay" missing={missingKeys.has('barangay')} /></Label>
          <Input
            value={form.barangay || ''}
            onChange={set('barangay')}
            className={cn(missingKeys.has('barangay') && 'border-red-300 focus:border-red-400')}
          />
        </div>
        <div>
          <Label><RequiredLabel label="Municipality" missing={missingKeys.has('municipality')} /></Label>
          <Input
            value={form.municipality || ''}
            onChange={set('municipality')}
            className={cn(missingKeys.has('municipality') && 'border-red-300 focus:border-red-400')}
          />
        </div>
        <div>
          <Label><RequiredLabel label="Province" missing={missingKeys.has('province')} /></Label>
          <Input
            value={form.province || ''}
            onChange={set('province')}
            className={cn(missingKeys.has('province') && 'border-red-300 focus:border-red-400')}
          />
        </div>
      </CardContent>
    </Card>
  )
}
