import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Download } from 'lucide-react'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'

import { Button } from '../../components/ui/Button'
import { PageHeader } from '../../components/ui/PageHeader'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { CardSkeleton } from '../../components/ui/Skeleton'
import api from '../../lib/axios'
import { fadeIn } from '../../lib/motion'
import { formatApiError } from '../../lib/utils'
import { useAuthStore } from '../../store/authStore'
import { DocumentsSection } from './profile-sections/DocumentsSection'
import { EducationSection } from './profile-sections/EducationSection'
import { EmploymentInfoSection } from './profile-sections/EmploymentInfoSection'
import { PersonalInfoSection } from './profile-sections/PersonalInfoSection'
import { SkillsSection } from './profile-sections/SkillsSection'

const OCR_TOAST = {
  real: { fn: toast.success, message: 'Resume processed — profile auto-filled from OCR.' },
  error: { fn: toast.error, message: "We couldn't automatically read this resume. Please fill in your details manually." },
}

export default function JobseekerProfile() {
  const queryClient = useQueryClient()
  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => (await api.get('/api/profile')).data.data,
  })

  const [form, setForm] = useState(null)
  const [uploadingResume, setUploadingResume] = useState(false)
  const [uploadingPicture, setUploadingPicture] = useState(false)
  const [uploadingDocType, setUploadingDocType] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (profile) setForm(profile)
  }, [profile])

  const refreshFrom = (data) => {
    setForm(data)
    queryClient.setQueryData(['profile'], data)
  }

  const uploadResume = async (file) => {
    setUploadingResume(true)
    const fd = new FormData()
    fd.append('file', file)
    try {
      const res = await api.post('/api/profile/resume', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      const { ocr_status } = res.data.data
      const toastConfig = OCR_TOAST[ocr_status] || OCR_TOAST.error
      toastConfig.fn(res.data.message || toastConfig.message)
      refreshFrom(res.data.data)
    } catch {
      toast.error('Could not process resume.')
    } finally {
      setUploadingResume(false)
    }
  }

  const uploadPicture = async (file) => {
    setUploadingPicture(true)
    const fd = new FormData()
    fd.append('file', file)
    try {
      const res = await api.post('/api/profile/picture', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      toast.success('Profile picture updated.')
      refreshFrom(res.data.data)
      // Keep the nav bar avatar (authStore.user, a separate data source from this
      // page's React Query cache) in sync immediately — no re-login needed.
      useAuthStore.getState().updateUser({ profile_picture_url: res.data.data.profile_picture_url })
    } catch {
      toast.error('Could not upload profile picture.')
    } finally {
      setUploadingPicture(false)
    }
  }

  const uploadDocument = async (documentType, file) => {
    setUploadingDocType(documentType)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('document_type', documentType)
    try {
      const res = await api.post('/api/profile/documents', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      toast.success('Document uploaded.')
      refreshFrom(res.data.data)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not upload document.')
    } finally {
      setUploadingDocType(null)
    }
  }

  const deleteDocument = async (documentId) => {
    try {
      const res = await api.delete(`/api/profile/documents/${documentId}`)
      toast.success('Document removed.')
      refreshFrom(res.data.data)
    } catch {
      toast.error('Could not remove document.')
    }
  }

  const save = async () => {
    setSaving(true)
    try {
      const res = await api.put('/api/profile', form)
      toast.success('Profile updated.')
      refreshFrom(res.data.data)
    } catch (err) {
      toast.error(formatApiError(err, 'Could not save profile.'))
    } finally {
      setSaving(false)
    }
  }

  if (isLoading || !form) return <CardSkeleton />

  return (
    <motion.div {...fadeIn} className="space-y-6">
      <PageHeader
        title="My Profile"
        description="Complete every required section and document to reach 100% and unlock verification."
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              disabled={form.profile_completion < 100}
              onClick={() => window.open(`${api.defaults.baseURL}/api/profile/application-pdf`, '_blank')}
            >
              <Download className="h-4 w-4" /> Download Application Profile (PDF)
            </Button>
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save Changes'}
            </Button>
          </>
        }
      />

      <ProgressBar percent={form.profile_completion} />

      <PersonalInfoSection form={form} setForm={setForm} onUploadPicture={uploadPicture} uploadingPicture={uploadingPicture} />
      <EducationSection form={form} setForm={setForm} />
      <EmploymentInfoSection form={form} setForm={setForm} />
      <SkillsSection form={form} setForm={setForm} />
      <DocumentsSection
        form={form}
        onUploadResume={uploadResume}
        uploadingResume={uploadingResume}
        onUploadDocument={uploadDocument}
        onDeleteDocument={deleteDocument}
        uploadingDocType={uploadingDocType}
      />
    </motion.div>
  )
}
