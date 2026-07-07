import { UserRound } from 'lucide-react'
import { useDropzone } from 'react-dropzone'

import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card'
import { Input, Label, Select } from '../../../components/ui/Input'
import { CIVIL_STATUSES, GENDERS } from './options'

export function PersonalInfoSection({ form, setForm, onUploadPicture, uploadingPicture }) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'image/*': [] },
    maxFiles: 1,
    disabled: uploadingPicture,
    onDrop: (accepted) => {
      if (accepted.length) onUploadPicture(accepted[0])
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
            <p className="text-sm font-medium text-slate-700">Profile Picture</p>
            <p className="text-xs text-slate-400">{uploadingPicture ? 'Uploading…' : 'Click or drag an image to upload'}</p>
          </div>
        </div>

        <div>
          <Label>Full Name</Label>
          <Input value={form.full_name || ''} onChange={set('full_name')} />
        </div>
        <div>
          <Label>Email Address</Label>
          <Input value={form.email || ''} disabled />
        </div>
        <div>
          <Label>Contact Number</Label>
          <Input value={form.contact_number || ''} onChange={set('contact_number')} />
        </div>
        <div>
          <Label>Date of Birth</Label>
          <div className="flex items-center gap-2">
            <Input type="date" value={form.date_of_birth || ''} onChange={set('date_of_birth')} />
            {form.age != null && <span className="whitespace-nowrap text-xs text-slate-400">{form.age} yrs old</span>}
          </div>
        </div>
        <div>
          <Label>Gender</Label>
          <Select value={form.gender || ''} onChange={set('gender')}>
            <option value="">Select…</option>
            {GENDERS.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Civil Status</Label>
          <Select value={form.civil_status || ''} onChange={set('civil_status')}>
            <option value="">Select…</option>
            {CIVIL_STATUSES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Nationality</Label>
          <Input value={form.nationality || ''} onChange={set('nationality')} />
        </div>
        <div>
          <Label>Barangay</Label>
          <Input value={form.barangay || ''} onChange={set('barangay')} />
        </div>
        <div>
          <Label>Municipality</Label>
          <Input value={form.municipality || ''} onChange={set('municipality')} />
        </div>
        <div>
          <Label>Province</Label>
          <Input value={form.province || ''} onChange={set('province')} />
        </div>
      </CardContent>
    </Card>
  )
}
