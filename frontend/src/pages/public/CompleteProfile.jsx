import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useDropzone } from 'react-dropzone'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import { Upload } from 'lucide-react'

import { Button } from '../../components/ui/Button'
import api from '../../lib/axios'
import { AuthLayout } from './AuthLayout'

export default function CompleteProfile() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [uploading, setUploading] = useState(false)
  const [done, setDone] = useState(false)

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'image/*': [], 'application/pdf': [] },
    maxFiles: 1,
    onDrop: async (accepted) => {
      if (!accepted.length) return
      setUploading(true)
      const fd = new FormData()
      fd.append('file', accepted[0])
      try {
        const res = await api.post('/api/profile/resume', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
        // Keep the ['profile'] cache (read by both this flow's eventual Dashboard
        // landing and the Profile page) in sync with the freshly OCR-filled data,
        // mirroring Profile.jsx's refreshFrom() — without this, a profile cached
        // earlier in the session could still show stale pre-OCR data.
        queryClient.setQueryData(['profile'], res.data.data)
        if (res.data.data.ocr_status === 'real') {
          toast.success('Resume processed! Your profile has been auto-filled.')
        } else {
          toast.error("We couldn't automatically read this resume. You can fill in your details later from your profile.")
        }
        setDone(true)
      } catch {
        toast.error('Could not process resume. You can add it later from your profile.')
      } finally {
        setUploading(false)
      }
    },
  })

  return (
    <AuthLayout title="Complete Your Profile" subtitle="Upload your resume so we can auto-fill your profile and start matching you with jobs">
      <div
        {...getRootProps()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-10 text-center transition-colors ${
          isDragActive ? 'border-primary-400 bg-primary-50' : 'border-slate-200 hover:border-primary-300'
        }`}
      >
        <input {...getInputProps()} />
        <Upload className="mb-2 h-6 w-6 text-slate-400" />
        <p className="text-sm text-slate-600">{uploading ? 'Processing with OCR…' : 'Drag & drop your resume, or click to browse'}</p>
        <p className="mt-1 text-xs text-slate-400">PDF or image</p>
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={() => navigate('/jobseeker/dashboard')}>
          Skip for now
        </Button>
        <Button onClick={() => navigate('/jobseeker/dashboard')} disabled={!done}>
          Continue to Dashboard
        </Button>
      </div>
    </AuthLayout>
  )
}
