import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Eye, Save, Send, Sparkles, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { useNavigate, useParams } from 'react-router-dom'

import { AddressCard } from '../../components/ui/AddressCard'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { useConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Dialog, DialogContent } from '../../components/ui/Dialog'
import { PageHeader } from '../../components/ui/PageHeader'
import { CardSkeleton } from '../../components/ui/Skeleton'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { VacancyDisplay } from '../../components/vacancy/VacancyDisplay'
import { useSocket } from '../../hooks/useSocket'
import api from '../../lib/axios'
import { fadeIn } from '../../lib/motion'
import { formatApiError } from '../../lib/utils'
import { AdditionalInfoSection } from './vacancy-sections/AdditionalInfoSection'
import { ApplicantPreferencesSection } from './vacancy-sections/ApplicantPreferencesSection'
import { BasicSection } from './vacancy-sections/BasicSection'
import { ContactPersonSection } from './vacancy-sections/ContactPersonSection'
import { DescriptionSection } from './vacancy-sections/DescriptionSection'
import { HiringDetailsSection } from './vacancy-sections/HiringDetailsSection'
import { QualificationsSection } from './vacancy-sections/QualificationsSection'
import { RequiredDocumentsSection } from './vacancy-sections/RequiredDocumentsSection'
import { SalarySection } from './vacancy-sections/SalarySection'
import { ScreeningQuestionsSection } from './vacancy-sections/ScreeningQuestionsSection'

const EMPTY_FORM = {
  title: '', num_slots: 1, required_skills: [], required_certifications: [], benefits: [],
  pref_languages: [], required_applicant_documents: [], screening_questions: [],
}

export default function EmployerVacancyForm() {
  const { id } = useParams()
  const isEdit = !!id
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [form, setForm] = useState(EMPTY_FORM)
  const [actionLoading, setActionLoading] = useState(null)
  const [showPreview, setShowPreview] = useState(false)
  // Set once a brand-new vacancy's initial create succeeds but the chained
  // submit fails (e.g. accreditation pending) — so retrying "Submit for
  // Approval" reuses the same row instead of creating a duplicate draft.
  const [createdId, setCreatedId] = useState(null)
  const { confirm, ConfirmDialogElement } = useConfirmDialog()

  const workingId = id || createdId

  const { data: vacancy, isLoading } = useQuery({
    queryKey: ['vacancies', id],
    queryFn: async () => (await api.get(`/api/vacancies/${id}`)).data.data,
    enabled: isEdit,
  })
  const { data: categories } = useQuery({
    queryKey: ['vacancies', 'categories'],
    queryFn: async () => (await api.get('/api/vacancies/categories')).data.data,
  })
  const { data: matches } = useQuery({
    queryKey: ['vacancies', id, 'matches'],
    queryFn: async () => (await api.get(`/api/vacancies/${id}/matched-jobseekers`)).data.data,
    enabled: isEdit && vacancy?.status === 'published',
  })
  // Only needed for the Preview's company branding when creating a brand-new
  // vacancy — `form` won't have company_name/logo_url until the first save.
  const { data: company } = useQuery({
    queryKey: ['company'],
    queryFn: async () => (await api.get('/api/company')).data.data,
    enabled: showPreview && !form.company_name,
  })

  useEffect(() => {
    if (vacancy) setForm(vacancy)
  }, [vacancy])

  // Live status updates from PESO Staff/Admin (approve/reject/publish/close/etc.)
  // while the employer has this vacancy open, without a manual refresh.
  useSocket({
    'public:homepage_update': (payload) => {
      if (isEdit && payload?.sections?.includes('jobs')) {
        queryClient.invalidateQueries({ queryKey: ['vacancies', id] })
      }
    },
  })

  const refreshFrom = (data) => {
    setForm(data)
    queryClient.setQueryData(['vacancies', id], data)
    queryClient.invalidateQueries({ queryKey: ['vacancies', 'my'] })
  }

  const buildPayload = () => ({
    // Drop any screening question the employer added but left blank — an empty
    // question is meaningless anyway, and the backend rejects it (question_text
    // is required), so silently keeping it around would otherwise block every
    // save with an error the user has no visible field to fix.
    ...form, screening_questions: (form.screening_questions || []).filter((q) => q.question_text?.trim()),
  })

  const submitForApproval = async () => {
    setActionLoading('submit')
    try {
      let vacancyId = workingId
      if (!vacancyId) {
        const res = await api.post('/api/vacancies', buildPayload())
        vacancyId = res.data.data.id
        setCreatedId(vacancyId)
      } else {
        await api.put(`/api/vacancies/${vacancyId}`, buildPayload())
      }
      await api.post(`/api/vacancies/${vacancyId}/submit`)
      toast.success('Vacancy submitted for PESO Staff approval.')
      queryClient.invalidateQueries({ queryKey: ['vacancies', 'my'] })
      navigate('/employer/vacancies')
    } catch (err) {
      toast.error(formatApiError(err, 'Could not submit vacancy.'))
    } finally {
      setActionLoading(null)
    }
  }

  const publish = async () => {
    setActionLoading('publish')
    try {
      await api.put(`/api/vacancies/${id}`, buildPayload())
      const res = await api.post(`/api/vacancies/${id}/publish`)
      toast.success('Vacancy published.')
      refreshFrom(res.data.data)
    } catch (err) {
      toast.error(formatApiError(err, 'Could not publish vacancy.'))
    } finally {
      setActionLoading(null)
    }
  }

  const saveChanges = async () => {
    setActionLoading('save')
    try {
      const res = await api.put(`/api/vacancies/${id}`, buildPayload())
      toast.success('Vacancy updated.')
      refreshFrom(res.data.data)
    } catch (err) {
      toast.error(formatApiError(err, 'Could not save changes.'))
    } finally {
      setActionLoading(null)
    }
  }

  const runAction = async (action, successMessage) => {
    setActionLoading(action)
    try {
      const res = await api.post(`/api/vacancies/${id}/${action}`)
      toast.success(successMessage || res.data.message)
      refreshFrom(res.data.data)
    } catch (err) {
      toast.error(formatApiError(err, `Could not ${action} vacancy.`))
    } finally {
      setActionLoading(null)
    }
  }

  const deleteVacancy = async () => {
    setActionLoading('delete')
    try {
      const res = await api.delete(`/api/vacancies/${id}`)
      toast.success(res.data.message)
      queryClient.invalidateQueries({ queryKey: ['vacancies', 'my'] })
      navigate('/employer/vacancies')
    } catch (err) {
      toast.error(formatApiError(err, 'Could not delete vacancy.'))
      setActionLoading(null)
    }
  }

  if (isEdit && isLoading) return <CardSkeleton />

  const status = form.status || 'draft'
  const isDraftOrRejected = status === 'draft' || status === 'rejected'
  const isDraft = status === 'draft'
  const isApproved = status === 'approved'
  const isPublished = status === 'published'
  const isClosed = status === 'closed'
  const isFilled = status === 'filled'

  const confirmSaveChanges = () =>
    confirm({
      title: 'Save these changes?',
      description: 'Are you sure you want to save these changes? The published vacancy will be updated immediately for everyone viewing it.',
      confirmLabel: 'Save Changes',
      onConfirm: saveChanges,
    })

  const confirmClose = () =>
    confirm({
      title: 'Close this vacancy?',
      description: 'It will stop accepting new applications and be removed from Job Search. You can reopen it later.',
      confirmLabel: 'Close Vacancy',
      danger: true,
      onConfirm: () => runAction('close', 'Vacancy closed.'),
    })

  const confirmDelete = () =>
    confirm({
      title: isDraft ? 'Delete this draft?' : 'Delete this vacancy?',
      description: isDraft
        ? 'This cannot be undone.'
        : 'This vacancy will be removed from every listing. PESO Admin can restore it later if needed.',
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: deleteVacancy,
    })

  return (
    <motion.div {...fadeIn} className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title={isEdit ? 'Edit Vacancy' : 'Post New Vacancy'}
        actions={isEdit && <StatusBadge status={status} />}
      />

      {status === 'rejected' && form.rejection_remarks && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">Rejected: {form.rejection_remarks}</p>
      )}
      {status === 'suspended' && form.suspended_reason && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-700">Suspended: {form.suspended_reason}</p>
      )}

      <BasicSection form={form} setForm={setForm} categories={categories || []} />
      <DescriptionSection form={form} setForm={setForm} />
      <QualificationsSection form={form} setForm={setForm} />
      <SalarySection form={form} setForm={setForm} />
      <AddressCard title="Location" form={form} setForm={setForm} />
      <HiringDetailsSection form={form} setForm={setForm} />
      <ApplicantPreferencesSection form={form} setForm={setForm} />
      <RequiredDocumentsSection form={form} setForm={setForm} />
      <ScreeningQuestionsSection form={form} setForm={setForm} />
      <ContactPersonSection form={form} setForm={setForm} />
      <AdditionalInfoSection form={form} setForm={setForm} />

      <Card>
        <CardContent className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => navigate('/employer/vacancies')}>Cancel</Button>
          <Button type="button" variant="secondary" onClick={() => setShowPreview(true)}>
            <Eye className="h-4 w-4" /> Preview
          </Button>

          {isDraftOrRejected && (
            <>
              <Button type="button" onClick={submitForApproval} disabled={actionLoading === 'submit'}>
                <Send className="h-4 w-4" /> {actionLoading === 'submit' ? 'Submitting…' : 'Submit for Approval'}
              </Button>
              {isEdit && isDraft && (
                <Button type="button" variant="danger" onClick={confirmDelete} disabled={actionLoading === 'delete'}>
                  <Trash2 className="h-4 w-4" /> Delete Draft
                </Button>
              )}
            </>
          )}

          {isApproved && (
            <Button type="button" onClick={publish} disabled={actionLoading === 'publish'}>
              {actionLoading === 'publish' ? 'Publishing…' : 'Publish'}
            </Button>
          )}

          {isPublished && (
            <>
              <Button type="button" variant="danger" onClick={confirmDelete} disabled={actionLoading === 'delete'}>
                <Trash2 className="h-4 w-4" /> Delete Vacancy
              </Button>
              <Button type="button" variant="secondary" onClick={confirmClose} disabled={actionLoading === 'close'}>
                {actionLoading === 'close' ? 'Closing…' : 'Close'}
              </Button>
              <Button type="button" onClick={confirmSaveChanges} disabled={actionLoading === 'save'}>
                <Save className="h-4 w-4" /> {actionLoading === 'save' ? 'Saving…' : 'Save Changes'}
              </Button>
            </>
          )}

          {isClosed && (
            <>
              <Button type="button" onClick={() => runAction('reopen', 'Vacancy reopened.')} disabled={actionLoading === 'reopen'}>
                {actionLoading === 'reopen' ? 'Reopening…' : 'Reopen'}
              </Button>
              <Button type="button" variant="danger" onClick={confirmDelete} disabled={actionLoading === 'delete'}>
                <Trash2 className="h-4 w-4" /> Delete Vacancy
              </Button>
            </>
          )}

          {isFilled && (
            <Button type="button" variant="danger" onClick={confirmDelete} disabled={actionLoading === 'delete'}>
              <Trash2 className="h-4 w-4" /> Delete Vacancy
            </Button>
          )}
        </CardContent>
      </Card>

      {isEdit && matches?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary-600" /> AI-Suggested Matched Jobseekers
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {matches.map((m) => (
              <div key={m.profile.id} className="flex items-center justify-between rounded-lg border border-slate-100 p-3">
                <span className="text-sm text-slate-800">{m.profile.full_name}</span>
                <Badge variant="primary">{m.match_score}% Match</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent
          title="Vacancy Preview"
          description="Exactly how this posting will appear to jobseekers once published."
          className="max-w-4xl"
        >
          <div className="max-h-[75vh] overflow-y-auto pr-1">
            <VacancyDisplay
              vacancy={{
                ...form,
                company_name: form.company_name || company?.company_name,
                company_logo_url: form.company_logo_url || company?.logo_url,
              }}
              companyVerified={company?.accreditation_status === 'accredited'}
            />
          </div>
        </DialogContent>
      </Dialog>

      {ConfirmDialogElement}
    </motion.div>
  )
}
