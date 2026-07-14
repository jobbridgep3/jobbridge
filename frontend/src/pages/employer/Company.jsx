import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'

import { AddressCard } from '../../components/ui/AddressCard'
import { Button } from '../../components/ui/Button'
import { CompletionChecklist } from '../../components/ui/CompletionChecklist'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { PageHeader } from '../../components/ui/PageHeader'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { CardSkeleton } from '../../components/ui/Skeleton'
import { StatusBadge } from '../../components/ui/StatusBadge'
import api from '../../lib/axios'
import { fadeIn } from '../../lib/motion'
import { formatApiError } from '../../lib/utils'
import { BasicInfoSection } from './company-sections/BasicInfoSection'
import { BusinessRegistrationSection } from './company-sections/BusinessRegistrationSection'
import { DocumentsSection } from './company-sections/DocumentsSection'
import { EmploymentInfoSection } from './company-sections/EmploymentInfoSection'
import { RepresentativeSection } from './company-sections/RepresentativeSection'
import { computeCompletion, SECTION_LABELS } from './company-sections/requiredFields'
import { SocialMediaSection } from './company-sections/SocialMediaSection'

export default function EmployerCompany() {
  const queryClient = useQueryClient()
  const { data: company, isLoading } = useQuery({
    queryKey: ['company'],
    queryFn: async () => (await api.get('/api/company')).data.data,
  })

  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingSignature, setUploadingSignature] = useState(false)
  const [uploadingDocType, setUploadingDocType] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [confirmSubmit, setConfirmSubmit] = useState(false)

  // Seed `form` from the server response exactly once (the initial load) — see
  // Profile.jsx for why re-running this on every cache write (which used to
  // happen, since setQueryData installs a new object reference) clobbers
  // patchFrom's narrow merge and any unsaved edit in progress elsewhere.
  const initializedRef = useRef(false)
  useEffect(() => {
    if (company && !initializedRef.current) {
      setForm(company)
      initializedRef.current = true
    }
  }, [company])

  // Full replace of both the query cache and the local edit-in-progress form —
  // only correct for actions that intentionally commit the current form (save,
  // submit-for-accreditation), where there's no unrelated unsaved edit to protect.
  const refreshFrom = (data) => {
    setForm(data)
    queryClient.setQueryData(['company'], data)
  }

  // Uploads only change one slice of the company profile (logo/signature/a
  // document), but the endpoint's response is the full company object. Sync the
  // cache with the full response, but only patch the changed slice into the
  // local form so unsaved edits in other sections survive.
  const patchFrom = (data, patch) => {
    setForm((f) => ({ ...f, ...patch }))
    queryClient.setQueryData(['company'], data)
  }

  const save = async () => {
    setSaving(true)
    try {
      const res = await api.put('/api/company', form)
      toast.success('Company profile updated.')
      refreshFrom(res.data.data)
    } catch (err) {
      toast.error(formatApiError(err, 'Could not save company profile.'))
    } finally {
      setSaving(false)
    }
  }

  const uploadLogo = async (file) => {
    setUploadingLogo(true)
    const fd = new FormData()
    fd.append('file', file)
    try {
      const res = await api.post('/api/company/logo', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      toast.success('Logo uploaded.')
      patchFrom(res.data.data, { logo_url: res.data.data.logo_url })
    } catch {
      toast.error('Could not upload logo.')
    } finally {
      setUploadingLogo(false)
    }
  }

  const uploadSignature = async (file) => {
    setUploadingSignature(true)
    const fd = new FormData()
    fd.append('file', file)
    try {
      const res = await api.post('/api/company/signature', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      toast.success('Signature uploaded.')
      patchFrom(res.data.data, { rep_signature_url: res.data.data.rep_signature_url })
    } catch {
      toast.error('Could not upload signature.')
    } finally {
      setUploadingSignature(false)
    }
  }

  const uploadDocument = async (documentType, file) => {
    setUploadingDocType(documentType)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('document_type', documentType)
    try {
      const res = await api.post('/api/company/documents', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
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
      const res = await api.delete(`/api/company/documents/${documentId}`)
      toast.success('Document removed.')
      const { documents, profile_completion, completed_count, total_count, missing_fields } = res.data.data
      patchFrom(res.data.data, { documents, profile_completion, completed_count, total_count, missing_fields })
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not remove document.')
    }
  }

  const submitAccreditation = async () => {
    setConfirmSubmit(false)
    setSubmitting(true)
    try {
      const res = await api.post('/api/company/submit-accreditation')
      toast.success('Submitted for PESO/Admin accreditation review.')
      refreshFrom(res.data.data)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not submit for accreditation.')
    } finally {
      setSubmitting(false)
    }
  }

  const completion = useMemo(() => (form ? computeCompletion(form) : null), [form])
  const missingKeys = useMemo(() => new Set((completion?.missingFields || []).map((f) => f.key)), [completion])

  if (isLoading || !form) return <CardSkeleton />

  const canSubmitAccreditation = ['not_submitted', 'rejected'].includes(form.accreditation_status)

  return (
    <motion.div {...fadeIn} className="space-y-6">
      <PageHeader
        title="Company Profile"
        description="Official company listing used by PESO Staff/Admin for accreditation."
        actions={
          <>
            <StatusBadge status={form.accreditation_status} />
            <Button size="sm" onClick={save} disabled={saving || uploadingLogo || uploadingSignature || !!uploadingDocType}>
              {saving ? 'Saving…' : 'Save Changes'}
            </Button>
            {canSubmitAccreditation && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setConfirmSubmit(true)}
                disabled={completion.profileCompletion < 100 || submitting}
              >
                {submitting ? 'Submitting…' : 'Submit for Accreditation'}
              </Button>
            )}
          </>
        }
      />

      {form.accreditation_status === 'rejected' && form.accreditation_remarks && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">Accreditation rejected: {form.accreditation_remarks}</p>
      )}
      {form.accreditation_status === 'pending_review' && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Your accreditation is under PESO/Admin review.</p>
      )}

      <ProgressBar percent={completion.profileCompletion} />
      <CompletionChecklist completion={completion} sectionLabels={SECTION_LABELS} />

      <div id="section-basic">
        <BasicInfoSection form={form} setForm={setForm} onUploadLogo={uploadLogo} uploadingLogo={uploadingLogo} missingKeys={missingKeys} />
      </div>
      <div id="section-business_registration">
        <BusinessRegistrationSection form={form} setForm={setForm} missingKeys={missingKeys} />
      </div>
      <div id="section-address">
        <AddressCard title="Company Address" form={form} setForm={setForm} missingKeys={missingKeys} />
      </div>
      <div id="section-representative">
        <RepresentativeSection form={form} setForm={setForm} onUploadSignature={uploadSignature} uploadingSignature={uploadingSignature} missingKeys={missingKeys} />
      </div>
      <div id="section-employment">
        <EmploymentInfoSection form={form} setForm={setForm} missingKeys={missingKeys} />
      </div>
      <SocialMediaSection form={form} setForm={setForm} />
      <div id="section-documents">
        <DocumentsSection form={form} onUploadDocument={uploadDocument} onDeleteDocument={deleteDocument} uploadingDocType={uploadingDocType} />
      </div>

      <ConfirmDialog
        open={confirmSubmit}
        onOpenChange={setConfirmSubmit}
        onConfirm={submitAccreditation}
        title="Submit for Accreditation?"
        description="Your company profile and documents will be sent to PESO/Admin for review. You won't be able to edit most fields while the review is pending."
        confirmLabel="Submit"
        loading={submitting}
      />
    </motion.div>
  )
}
