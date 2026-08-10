import { Upload } from 'lucide-react'
import { useDropzone } from 'react-dropzone'

import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card'

const ACCEPT = {
  'image/*': [],
  'application/pdf': [],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [],
}

export function ResumeUploadSection({ form, onUploadResume, uploadingResume, missingKeys = new Set() }) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: ACCEPT,
    maxFiles: 1,
    disabled: uploadingResume,
    onDrop: (accepted) => {
      if (accepted.length) onUploadResume(accepted[0])
    },
  })

  return (
    <div className="space-y-3">
      <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
        Upload your resume and we'll auto-fill your profile for you. Extraction may not be 100% accurate — always review
        each field after uploading and correct anything that's wrong or missing.
      </p>
      <Card>
        <CardHeader>
          <CardTitle>Resume / CV</CardTitle>
          {missingKeys.has('resume_url') && <span className="text-xs font-medium text-red-600">Required</span>}
        </CardHeader>
        <CardContent>
          <div
            {...getRootProps()}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
              isDragActive ? 'border-primary-400 bg-primary-50' : 'border-slate-200 hover:border-primary-300'
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="mb-2 h-6 w-6 text-slate-400" />
            <p className="text-sm text-slate-600">
              {uploadingResume ? 'Reading your resume…' : 'Drag & drop your resume, or click to browse'}
            </p>
            <p className="mt-1 text-xs text-slate-400">PDF, DOCX, JPG, or PNG — auto-fills your profile fields</p>
          </div>
          {form.resume_url && (
            <a href={form.resume_url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm text-primary-700 hover:underline">
              View uploaded resume
            </a>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
