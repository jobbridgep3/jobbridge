import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'

import { AddressCard } from '../../components/ui/AddressCard'
import { Button } from '../../components/ui/Button'
import { CompletionChecklist } from '../../components/ui/CompletionChecklist'
import { PageHeader } from '../../components/ui/PageHeader'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { CardSkeleton } from '../../components/ui/Skeleton'
import api from '../../lib/axios'
import { fadeIn } from '../../lib/motion'
import { formatApiError } from '../../lib/utils'
import { useAuthStore } from '../../store/authStore'
import { ContactSection } from './hr-sections/ContactSection'
import { DocumentsSection } from './hr-sections/DocumentsSection'
import { EmergencyContactSection } from './hr-sections/EmergencyContactSection'
import { EmploymentSection } from './hr-sections/EmploymentSection'
import { PersonalSection } from './hr-sections/PersonalSection'
import { computeCompletion, SECTION_LABELS } from './hr-sections/requiredFields'

export default function EmployerProfile() {
  const queryClient = useQueryClient()
  const { data: profile, isLoading } = useQuery({
    queryKey: ['employer-profile'],
    queryFn: async () => (await api.get('/api/employer/profile')).data.data,
  })

  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [uploadingPicture, setUploadingPicture] = useState(false)
  const [uploadingDocType, setUploadingDocType] = useState(null)

  useEffect(() => {
    if (profile) setForm(profile)
  }, [profile])

  // Full replace of both the query cache and the local edit-in-progress form —
  // only correct for the explicit "commit current form" action (save/submit),
  // where there's no unrelated unsaved edit to protect.
  const refreshFrom = (data) => {
    setForm(data)
    queryClient.setQueryData(['employer-profile'], data)
  }

  // Uploads only change one slice of the profile (a picture/document), but the
  // endpoint's response is the full profile object. Sync the cache with the
  // full response (it should mirror server truth), but only patch the changed
  // slice into the local form so unsaved edits in other sections survive.
  const patchFrom = (data, patch) => {
    setForm((f) => ({ ...f, ...patch }))
    queryClient.setQueryData(['employer-profile'], data)
  }

  const save = async () => {
    setSaving(true)
    try {
      const res = await api.put('/api/employer/profile', form)
      toast.success('Profile updated.')
      refreshFrom(res.data.data)
    } catch (err) {
      toast.error(formatApiError(err, 'Could not save profile.'))
    } finally {
      setSaving(false)
    }
  }

  const uploadPicture = async (file) => {
    setUploadingPicture(true)
    const fd = new FormData()
    fd.append('file', file)
    try {
      const res = await api.post('/api/employer/profile/picture', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      toast.success('Profile picture updated.')
      patchFrom(res.data.data, { profile_picture_url: res.data.data.profile_picture_url })
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
      const res = await api.post('/api/employer/profile/documents', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      toast.success('Document uploaded for PESO Staff review.')
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
      const res = await api.delete(`/api/employer/profile/documents/${documentId}`)
      toast.success('Document removed.')
      const { documents, profile_completion, completed_count, total_count, missing_fields } = res.data.data
      patchFrom(res.data.data, { documents, profile_completion, completed_count, total_count, missing_fields })
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not remove document.')
    }
  }

  const completion = useMemo(() => (form ? computeCompletion(form) : null), [form])
  const missingKeys = useMemo(() => new Set((completion?.missingFields || []).map((f) => f.key)), [completion])

  if (isLoading || !form) return <CardSkeleton />

  return (
    <motion.div {...fadeIn} className="space-y-6">
      <PageHeader
        title="My Profile"
        description="Your own HR/employer account details — separate from the Company Profile."
        actions={
          <Button size="sm" onClick={save} disabled={saving || uploadingPicture || !!uploadingDocType}>
            {saving ? 'Saving…' : 'Save Changes'}
          </Button>
        }
      />

      <ProgressBar percent={completion.profileCompletion} />
      <CompletionChecklist completion={completion} sectionLabels={SECTION_LABELS} />

      <div id="section-personal">
        <PersonalSection form={form} setForm={setForm} onUploadPicture={uploadPicture} uploadingPicture={uploadingPicture} missingKeys={missingKeys} />
      </div>
      <div id="section-contact">
        <ContactSection form={form} setForm={setForm} companyEmail={form.email} missingKeys={missingKeys} />
      </div>
      <div id="section-employment">
        <EmploymentSection form={form} setForm={setForm} missingKeys={missingKeys} />
      </div>
      <div id="section-address">
        <AddressCard title="Address" form={form} setForm={setForm} missingKeys={missingKeys} />
      </div>
      <EmergencyContactSection form={form} setForm={setForm} />
      <div id="section-documents">
        <DocumentsSection form={form} onUploadDocument={uploadDocument} onDeleteDocument={deleteDocument} uploadingDocType={uploadingDocType} />
      </div>
    </motion.div>
  )
}
