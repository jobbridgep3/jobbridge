import { UserRound } from 'lucide-react'
import { useDropzone } from 'react-dropzone'

import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card'
import { DatePicker } from '../../../components/ui/DatePicker'
import { Input, Label, Select } from '../../../components/ui/Input'
import { RequiredLabel } from '../../../components/ui/RequiredLabel'
import { cn } from '../../../lib/utils'
import { CIVIL_STATUSES, GENDERS } from './options'

export function PersonalSection({ form, setForm, onUploadPicture, uploadingPicture, missingKeys = new Set() }) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'image/*': [] },
    maxFiles: 1,
    disabled: uploadingPicture,
    onDrop: (accepted) => {
      if (accepted.length) onUploadPicture(accepted[0])
    },
  })

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))
  const err = (key) => cn(missingKeys.has(key) && 'border-red-300 focus:border-red-400')

  return (
    <Card>
      <CardHeader>
        <CardTitle>Personal</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2 flex items-center gap-4">
          <div
            {...getRootProps()}
            className={`flex h-16 w-16 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-dashed text-slate-400 ${
              isDragActive ? 'border-primary-400 bg-primary-50' : 'border-slate-200 hover:border-primary-300'
            }`}
          >
            <input {...getInputProps()} />
            {form.profile_picture_url ? (
              <img src={form.profile_picture_url} alt="Profile" className="h-full w-full object-cover" />
            ) : (
              <UserRound className="h-6 w-6" />
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-slate-700">Picture</p>
            <p className="text-xs text-slate-400">{uploadingPicture ? 'Uploading…' : 'Click or drag an image to upload'}</p>
          </div>
        </div>

        <div>
          <Label><RequiredLabel label="Full Name" missing={missingKeys.has('full_name')} /></Label>
          <Input value={form.full_name || ''} onChange={set('full_name')} className={err('full_name')} />
        </div>
        <div>
          <Label><RequiredLabel label="Gender" missing={missingKeys.has('gender')} /></Label>
          <Select value={form.gender || ''} onChange={set('gender')} className={err('gender')}>
            <option value="">Select…</option>
            {GENDERS.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label><RequiredLabel label="Birthday" missing={missingKeys.has('date_of_birth')} /></Label>
          <DatePicker value={form.date_of_birth || ''} onChange={(value) => setForm((f) => ({ ...f, date_of_birth: value }))} maxDate={new Date().toISOString().slice(0, 10)} className={err('date_of_birth')} />
        </div>
        <div>
          <Label><RequiredLabel label="Civil Status" missing={missingKeys.has('civil_status')} /></Label>
          <Select value={form.civil_status || ''} onChange={set('civil_status')} className={err('civil_status')}>
            <option value="">Select…</option>
            {CIVIL_STATUSES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label><RequiredLabel label="Nationality" missing={missingKeys.has('nationality')} /></Label>
          <Input value={form.nationality || ''} onChange={set('nationality')} className={err('nationality')} />
        </div>
      </CardContent>
    </Card>
  )
}
