import { useDropzone } from 'react-dropzone'

import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card'
import { Input, Label } from '../../../components/ui/Input'
import { RequiredLabel } from '../../../components/ui/RequiredLabel'
import { cn } from '../../../lib/utils'

export function RepresentativeSection({ form, setForm, onUploadSignature, uploadingSignature, missingKeys = new Set() }) {
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))
  const err = (key) => cn(missingKeys.has(key) && 'border-red-300 focus:border-red-400')

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'image/*': [] },
    maxFiles: 1,
    disabled: uploadingSignature,
    onDrop: (accepted) => {
      if (accepted.length) onUploadSignature(accepted[0])
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Company Representative</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label><RequiredLabel label="Name" missing={missingKeys.has('rep_name')} /></Label>
          <Input value={form.rep_name || ''} onChange={set('rep_name')} className={err('rep_name')} />
        </div>
        <div>
          <Label><RequiredLabel label="Position" missing={missingKeys.has('rep_position')} /></Label>
          <Input value={form.rep_position || ''} onChange={set('rep_position')} className={err('rep_position')} />
        </div>
        <div>
          <Label><RequiredLabel label="Email" missing={missingKeys.has('rep_email')} /></Label>
          <Input type="email" value={form.rep_email || ''} onChange={set('rep_email')} className={err('rep_email')} />
        </div>
        <div>
          <Label><RequiredLabel label="Contact Number" missing={missingKeys.has('rep_contact_number')} /></Label>
          <Input value={form.rep_contact_number || ''} onChange={set('rep_contact_number')} className={err('rep_contact_number')} />
        </div>
        <div>
          <Label>Government ID Number</Label>
          <Input value={form.rep_gov_id_number || ''} onChange={set('rep_gov_id_number')} />
        </div>
        <div>
          <Label>Digital Signature</Label>
          <div
            {...getRootProps()}
            className={`flex cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed p-3 text-center transition-colors ${
              isDragActive ? 'border-primary-400 bg-primary-50' : 'border-slate-200 hover:border-primary-300'
            }`}
          >
            <input {...getInputProps()} />
            {form.rep_signature_url && <img src={form.rep_signature_url} alt="Signature" className="h-10 rounded bg-white object-contain" />}
            <p className="text-xs text-slate-500">{uploadingSignature ? 'Uploading…' : 'Upload signature image'}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
