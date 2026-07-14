import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Download } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'

import { Button } from '../../components/ui/Button'
import { CompletionChecklist } from '../../components/ui/CompletionChecklist'
import { PageHeader } from '../../components/ui/PageHeader'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { CardSkeleton } from '../../components/ui/Skeleton'
import api from '../../lib/axios'
import { downloadFile, parseBlobError } from '../../lib/download'
import { fadeIn } from '../../lib/motion'
import { formatApiError } from '../../lib/utils'
import { useAuthStore } from '../../store/authStore'
import { DocumentsSection } from './profile-sections/DocumentsSection'
import { EducationSection } from './profile-sections/EducationSection'
import { EmploymentInfoSection } from './profile-sections/EmploymentInfoSection'
import { PersonalInfoSection } from './profile-sections/PersonalInfoSection'
import { computeCompletion } from './profile-sections/requiredFields'
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
  const [downloadingPdf, setDownloadingPdf] = useState(false)

  useEffect(() => {
    if (profile) setForm(profile)
  }, [profile])

  // Full replace of both the query cache and the local edit-in-progress form —
  // only correct for the explicit "commit current form" action (save), where
  // there's no unrelated unsaved edit to protect.
  const refreshFrom = (data) => {
    setForm(data)
    queryClient.setQueryData(['profile'], data)
  }

  // Uploads (picture/document) only change one slice of the profile, but the
  // endpoint's response is the full profile object. Sync the cache with the
  // full response, but only patch the changed slice into the local form so
  // unsaved edits in other sections survive.
  const patchFrom = (data, patch) => {
    setForm((f) => ({ ...f, ...patch }))
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
      // Unlike picture/document uploads, resume OCR is meant to autofill blank
      // profile fields (personal/education/employment/skills) — so this one
      // intentionally merges the full response rather than a narrow patch.
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
      patchFrom(res.data.data, { profile_picture_url: res.data.data.profile_picture_url })
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
      const { documents, profile_completion, completed_count, total_count, missing_fields } = res.data.data
      patchFrom(res.data.data, { documents, profile_completion, completed_count, total_count, missing_fields })
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
      const { documents, profile_completion, completed_count, total_count, missing_fields } = res.data.data
      patchFrom(res.data.data, { documents, profile_completion, completed_count, total_count, missing_fields })
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

  const downloadApplicationPdf = async () => {
    setDownloadingPdf(true)
    try {
      await downloadFile('/api/profile/application-pdf', { filename: 'jobbridge-application-profile.pdf' })
    } catch (err) {
      toast.error(await parseBlobError(err))
    } finally {
      setDownloadingPdf(false)
    }
  }

  // Recomputed from the live `form` on every keystroke — not just after a
  // fetch/save round-trip — so the progress bar and checklist update instantly as
  // the user edits. `form` is always set from the server response right after any
  // fetch/upload/save, so this is automatically server-accurate at those points too.
  const completion = useMemo(() => (form ? computeCompletion(form) : null), [form])
  const missingKeys = useMemo(() => new Set((completion?.missingFields || []).map((f) => f.key)), [completion])

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
              disabled={completion.profileCompletion < 100 || downloadingPdf}
              onClick={downloadApplicationPdf}
            >
              <Download className="h-4 w-4" /> {downloadingPdf ? 'Downloading…' : 'Download Application Profile (PDF)'}
            </Button>
            <Button size="sm" onClick={save} disabled={saving || uploadingResume || uploadingPicture || !!uploadingDocType}>
              {saving ? 'Saving…' : 'Save Changes'}
            </Button>
          </>
        }
      />

      <ProgressBar percent={completion.profileCompletion} />
      <CompletionChecklist completion={completion} />

      <div id="section-personal">
        <PersonalInfoSection
          form={form}
          setForm={setForm}
          onUploadPicture={uploadPicture}
          uploadingPicture={uploadingPicture}
          missingKeys={missingKeys}
        />
      </div>
      <div id="section-education">
        <EducationSection form={form} setForm={setForm} missingKeys={missingKeys} />
      </div>
      <div id="section-employment">
        <EmploymentInfoSection form={form} setForm={setForm} missingKeys={missingKeys} />
      </div>
      <div id="section-skills">
        <SkillsSection form={form} setForm={setForm} missingKeys={missingKeys} />
      </div>
      <div id="section-documents">
        <DocumentsSection
          form={form}
          onUploadResume={uploadResume}
          uploadingResume={uploadingResume}
          onUploadDocument={uploadDocument}
          onDeleteDocument={deleteDocument}
          uploadingDocType={uploadingDocType}
          missingKeys={missingKeys}
        />
      </div>
    </motion.div>
  )
}
