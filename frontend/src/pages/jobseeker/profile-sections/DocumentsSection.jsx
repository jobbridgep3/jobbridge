import { Upload } from 'lucide-react'
import { useDropzone } from 'react-dropzone'

import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card'
import { DocumentUploadSlot } from '../../../components/ui/DocumentUploadSlot'
import { DOCUMENT_TYPES } from './options'

export function DocumentsSection({ form, onUploadResume, uploadingResume, onUploadDocument, onDeleteDocument, uploadingDocType }) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'image/*': [], 'application/pdf': [] },
    maxFiles: 1,
    disabled: uploadingResume,
    onDrop: (accepted) => {
      if (accepted.length) onUploadResume(accepted[0])
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Documents</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
          Please upload clear, readable, and high-quality PDF or image files. Blurry, cropped, or unreadable documents may
          delay or prevent account verification.
        </p>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-800">Resume / CV</span>
            <span className="text-xs font-medium text-red-600">Required</span>
          </div>
          <div
            {...getRootProps()}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
              isDragActive ? 'border-primary-400 bg-primary-50' : 'border-slate-200 hover:border-primary-300'
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="mb-2 h-6 w-6 text-slate-400" />
            <p className="text-sm text-slate-600">{uploadingResume ? 'Processing with OCR…' : 'Drag & drop your resume, or click to browse'}</p>
            <p className="mt-1 text-xs text-slate-400">PDF or image — auto-extracts skills, name, and contact info</p>
          </div>
          {form.resume_url && (
            <a href={form.resume_url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm text-primary-700 hover:underline">
              View uploaded resume
            </a>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {DOCUMENT_TYPES.map(({ type, label, required, multiple }) => (
            <DocumentUploadSlot
              key={type}
              label={label}
              required={required}
              multiple={multiple}
              documents={(form.documents || []).filter((d) => d.document_type === type)}
              uploading={uploadingDocType === type}
              onUpload={(file) => onUploadDocument(type, file)}
              onDelete={(id) => onDeleteDocument(id)}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
