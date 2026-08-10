import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Download } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
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
import { isExtractionEmpty, mergeExtractedIntoForm } from './profile-sections/mergeExtracted'
import { computeCompletion } from './profile-sections/requiredFields'
import { ResumeScanModal } from './profile-sections/ResumeScanModal'
import { ResumeUploadSection } from './profile-sections/ResumeUploadSection'
import { SkillsSection } from './profile-sections/SkillsSection'

const COLLAPSIBLE_SECTIONS = ['personal', 'education', 'employment', 'skills']

const OCR_TOAST = {
  real: { fn: toast.success, message: 'Resume processed. Review the extracted fields below, then save your profile.' },
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
  const [scanState, setScanState] = useState({ open: false, phase: 'scanning', stepIndex: 0, extractedAt: null, errorDetail: null })
  // Session-only, cleared per key on edit/blur (see clearHighlight below) — never
  // persisted, purely a "review this" visual cue for fields auto-filled this session.
  const [highlightedFields, setHighlightedFields] = useState(new Set())
  // Session-only (not persisted to backend or localStorage, per spec) — resets to
  // all-expanded on every page load.
  const [openSections, setOpenSections] = useState({ personal: true, education: true, employment: true, skills: true })
  const [uploadingPicture, setUploadingPicture] = useState(false)
  const [uploadingDocType, setUploadingDocType] = useState(null)
  const [saving, setSaving] = useState(false)
  const [downloadingPdf, setDownloadingPdf] = useState(false)

  // Seed `form` from the server response exactly once (the initial load) — see
  // employer/Profile.jsx for why re-running this on every cache write (which
  // used to happen, since setQueryData installs a new object reference)
  // clobbers patchFrom's narrow merge and any unsaved edit in progress
  // elsewhere on the form.
  const initializedRef = useRef(false)
  useEffect(() => {
    if (profile && !initializedRef.current) {
      setForm(profile)
      initializedRef.current = true
    }
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
    setScanState({ open: true, phase: 'scanning', stepIndex: 0, extractedAt: null, errorDetail: null })
    const fd = new FormData()
    fd.append('file', file)
    try {
      const res = await api.post('/api/profile/resume', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        // Real, measured progress of sending the file to our own server — once it hits
        // 100%, our backend is now calling Gemini + validating the response, which has
        // no further observable signal, so step 2 just holds until the request resolves.
        onUploadProgress: (evt) => {
          if (evt.total && evt.loaded >= evt.total) {
            setScanState((s) => (s.stepIndex < 1 ? { ...s, stepIndex: 1 } : s))
          }
        },
      })
      const { resume_url, extracted, extracted_at, ocr_status, ocr_detail } = res.data.data
      // A "real" ocr_status with nothing usable in it is treated as an empty-extraction
      // failure, not a success — decided before picking the toast, so the toast and the
      // modal's phase never contradict each other (e.g. a success toast followed by the
      // modal flipping to its error state).
      const isEmpty = ocr_status === 'real' && isExtractionEmpty(extracted)
      const toastConfig = ocr_status === 'real' && !isEmpty ? OCR_TOAST.real : OCR_TOAST.error
      // The backend's own message text is only trustworthy when it agrees with our
      // local isEmpty decision — it always says "processed" for ocr_status "real",
      // which would read as a false success if we've decided to treat this as empty.
      toastConfig.fn(!isEmpty ? res.data.message || toastConfig.message : toastConfig.message)

      if (ocr_status === 'real' && !isEmpty) {
        // Merge against the LATEST form state (functional update), not the `form`
        // this closure captured when the upload started — the user may have edited
        // fields while the request was in flight. mergeExtractedIntoForm never
        // overwrites a field that already has a value (see mergeExtracted.js).
        let newHighlights = new Set()
        setForm((f) => {
          const { form: merged, highlightedKeys } = mergeExtractedIntoForm({ ...f, resume_url }, extracted)
          newHighlights = highlightedKeys
          return merged
        })
        setHighlightedFields((prev) => new Set([...prev, ...newHighlights]))
        // "Filling your profile" corresponds to the merge just above, which has
        // already happened synchronously by this point — not an artificial delay.
        setScanState({ open: true, phase: 'done', stepIndex: 2, extractedAt: extracted_at, errorDetail: null })
      } else {
        setForm((f) => ({ ...f, resume_url }))
        setScanState({
          open: true, phase: 'error', stepIndex: isEmpty ? 2 : 1, extractedAt: null,
          errorDetail: isEmpty
            ? "We couldn't find any information to extract from this document. Please fill in your details manually."
            : ocr_detail,
        })
      }
    } catch (err) {
      toast.error('Could not process resume.')
      setScanState({
        open: true, phase: 'error', stepIndex: 0, extractedAt: null,
        errorDetail: err.response?.data?.message || 'Something went wrong while uploading your resume.',
      })
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

  const toggleSection = (key) => setOpenSections((s) => ({ ...s, [key]: !s[key] }))

  const clearHighlight = (key) =>
    setHighlightedFields((s) => {
      if (!s.has(key)) return s
      const next = new Set(s)
      next.delete(key)
      return next
    })

  // resume_url stays tagged section "documents" in requiredFields.js for checklist
  // grouping (still labeled "Documents"), but physically renders in its own section
  // at the top of the page — redirect just that one item's scroll target, and expand
  // a collapsed section before scrolling to it so the click never lands on a hidden card.
  const navigateToSection = (item) => {
    const targetId = item.key === 'resume_url' ? 'resume' : item.section
    if (COLLAPSIBLE_SECTIONS.includes(item.section)) {
      setOpenSections((s) => ({ ...s, [item.section]: true }))
    }
    document.getElementById(`section-${targetId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
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
      <CompletionChecklist completion={completion} onNavigate={navigateToSection} />

      <div id="section-resume">
        <ResumeUploadSection form={form} onUploadResume={uploadResume} uploadingResume={uploadingResume} missingKeys={missingKeys} />
      </div>
      <div id="section-personal">
        <PersonalInfoSection
          form={form}
          setForm={setForm}
          onUploadPicture={uploadPicture}
          uploadingPicture={uploadingPicture}
          missingKeys={missingKeys}
          highlightedFields={highlightedFields}
          clearHighlight={clearHighlight}
          open={openSections.personal}
          onToggle={() => toggleSection('personal')}
        />
      </div>
      <div id="section-education">
        <EducationSection
          form={form}
          setForm={setForm}
          missingKeys={missingKeys}
          open={openSections.education}
          onToggle={() => toggleSection('education')}
        />
      </div>
      <div id="section-employment">
        <EmploymentInfoSection
          form={form}
          setForm={setForm}
          missingKeys={missingKeys}
          highlightedFields={highlightedFields}
          clearHighlight={clearHighlight}
          open={openSections.employment}
          onToggle={() => toggleSection('employment')}
        />
      </div>
      <div id="section-skills">
        <SkillsSection
          form={form}
          setForm={setForm}
          missingKeys={missingKeys}
          highlightedFields={highlightedFields}
          clearHighlight={clearHighlight}
          open={openSections.skills}
          onToggle={() => toggleSection('skills')}
        />
      </div>
      <div id="section-documents">
        <DocumentsSection form={form} onUploadDocument={uploadDocument} onDeleteDocument={deleteDocument} uploadingDocType={uploadingDocType} />
      </div>

      <ResumeScanModal
        open={scanState.open}
        phase={scanState.phase}
        stepIndex={scanState.stepIndex}
        extractedAt={scanState.extractedAt}
        errorDetail={scanState.errorDetail}
        onClose={() => setScanState((s) => ({ ...s, open: false }))}
      />
    </motion.div>
  )
}
