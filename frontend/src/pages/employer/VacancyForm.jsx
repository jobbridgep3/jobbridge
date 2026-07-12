import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Copy, Eye, FileText, Save, Send, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { useNavigate, useParams } from 'react-router-dom'

import { AddressCard } from '../../components/ui/AddressCard'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { Dialog, DialogContent } from '../../components/ui/Dialog'
import { Input, Label } from '../../components/ui/Input'
import { PageHeader } from '../../components/ui/PageHeader'
import { CardSkeleton } from '../../components/ui/Skeleton'
import { StatusBadge } from '../../components/ui/StatusBadge'
import api from '../../lib/axios'
import { fadeIn } from '../../lib/motion'
import { formatSalaryRange } from '../../lib/salaryFormat'
import { formatApiError } from '../../lib/utils'
import { canTransition } from '../../lib/vacancyStateMachine'
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
  const [saving, setSaving] = useState(false)
  const [actionLoading, setActionLoading] = useState(null)
  const [showPreview, setShowPreview] = useState(false)
  const [showSaveTemplate, setShowSaveTemplate] = useState(false)
  const [templateName, setTemplateName] = useState('')

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

  useEffect(() => {
    if (vacancy) setForm(vacancy)
  }, [vacancy])

  const refreshFrom = (data) => {
    setForm(data)
    queryClient.setQueryData(['vacancies', id], data)
    queryClient.invalidateQueries({ queryKey: ['vacancies', 'my'] })
  }

  const saveDraft = async () => {
    setSaving(true)
    // Drop any screening question the employer added but left blank — an empty
    // question is meaningless anyway, and the backend rejects it (question_text
    // is required), so silently keeping it around would otherwise block every
    // save with an error the user has no visible field to fix.
    const payload = { ...form, screening_questions: (form.screening_questions || []).filter((q) => q.question_text?.trim()) }
    try {
      if (isEdit) {
        const res = await api.put(`/api/vacancies/${id}`, payload)
        toast.success(res.data.message)
        refreshFrom(res.data.data)
      } else {
        const res = await api.post('/api/vacancies', payload)
        toast.success('Draft saved.')
        navigate(`/employer/vacancies/${res.data.data.id}/edit`)
      }
    } catch (err) {
      toast.error(formatApiError(err, 'Could not save vacancy.'))
    } finally {
      setSaving(false)
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

  const duplicateVacancy = async () => {
    setActionLoading('duplicate')
    try {
      const res = await api.post(`/api/vacancies/${id}/duplicate`)
      toast.success('Vacancy duplicated as a new draft.')
      navigate(`/employer/vacancies/${res.data.data.id}/edit`)
    } catch (err) {
      toast.error(formatApiError(err, 'Could not duplicate vacancy.'))
    } finally {
      setActionLoading(null)
    }
  }

  const saveAsTemplate = async () => {
    if (!templateName.trim()) return
    setActionLoading('save-template')
    try {
      await api.post(`/api/vacancies/${id}/save-template`, { template_name: templateName })
      toast.success('Saved as template.')
      setShowSaveTemplate(false)
      setTemplateName('')
    } catch (err) {
      toast.error(formatApiError(err, 'Could not save template.'))
    } finally {
      setActionLoading(null)
    }
  }

  const deleteDraft = async () => {
    if (!window.confirm('Delete this draft vacancy? This cannot be undone.')) return
    try {
      await api.delete(`/api/vacancies/${id}`)
      toast.success('Draft deleted.')
      queryClient.invalidateQueries({ queryKey: ['vacancies', 'my'] })
      navigate('/employer/vacancies')
    } catch (err) {
      toast.error(formatApiError(err, 'Could not delete draft.'))
    }
  }

  if (isEdit && isLoading) return <CardSkeleton />

  const status = form.status || 'draft'
  // Client-side mirror only decides which buttons to render — the backend
  // re-validates every transition regardless.
  const canSubmit = isEdit && canTransition(status, 'pending', 'employer')
  const canPublish = isEdit && canTransition(status, 'published', 'employer') && status === 'approved'
  const canReopen = isEdit && canTransition(status, 'published', 'employer') && status === 'closed'
  const canClose = isEdit && canTransition(status, 'closed', 'employer')
  const canMarkFilled = isEdit && canTransition(status, 'filled', 'employer')
  const canDelete = isEdit && status === 'draft'

  return (
    <motion.div {...fadeIn} className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title={isEdit ? 'Edit Vacancy' : 'Post New Vacancy'}
        actions={isEdit && <StatusBadge status={status} />}
      />

      {status === 'rejected' && form.rejection_remarks && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">Rejected: {form.rejection_remarks}</p>
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
          {isEdit && (
            <>
              <Button type="button" variant="secondary" onClick={duplicateVacancy} disabled={actionLoading === 'duplicate'}>
                <Copy className="h-4 w-4" /> Duplicate
              </Button>
              <Button type="button" variant="secondary" onClick={() => setShowSaveTemplate(true)}>
                <FileText className="h-4 w-4" /> Save as Template
              </Button>
            </>
          )}
          {canDelete && (
            <Button type="button" variant="danger" onClick={deleteDraft}>Delete Draft</Button>
          )}
          <Button type="button" onClick={saveDraft} disabled={saving}>
            <Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save Draft'}
          </Button>
          {canSubmit && (
            <Button type="button" onClick={() => runAction('submit', 'Submitted for approval.')} disabled={actionLoading === 'submit'}>
              <Send className="h-4 w-4" /> {actionLoading === 'submit' ? 'Submitting…' : 'Submit for Approval'}
            </Button>
          )}
          {canPublish && (
            <Button type="button" onClick={() => runAction('publish', 'Vacancy published.')} disabled={actionLoading === 'publish'}>
              {actionLoading === 'publish' ? 'Publishing…' : 'Publish'}
            </Button>
          )}
          {canReopen && (
            <Button type="button" onClick={() => runAction('reopen', 'Vacancy reopened.')} disabled={actionLoading === 'reopen'}>
              {actionLoading === 'reopen' ? 'Reopening…' : 'Reopen'}
            </Button>
          )}
          {canClose && (
            <Button type="button" variant="secondary" onClick={() => runAction('close', 'Vacancy closed.')} disabled={actionLoading === 'close'}>
              {actionLoading === 'close' ? 'Closing…' : 'Close'}
            </Button>
          )}
          {canMarkFilled && (
            <Button type="button" variant="secondary" onClick={() => runAction('mark-filled', 'Marked as filled.')} disabled={actionLoading === 'mark-filled'}>
              {actionLoading === 'mark-filled' ? 'Updating…' : 'Mark Filled'}
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
        <DialogContent title={form.title || 'Untitled Vacancy'} description={`${form.job_type || ''} • ${form.work_arrangement || ''}`} className="max-w-2xl">
          <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
            <p className="font-medium text-slate-700">{formatSalaryRange(form.salary_min, form.salary_max, form.hide_salary)}</p>
            {form.summary && <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: form.summary }} />}
            {form.responsibilities && (
              <div>
                <h4 className="text-sm font-semibold text-slate-700">Responsibilities</h4>
                <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: form.responsibilities }} />
              </div>
            )}
            {form.daily_tasks && (
              <div>
                <h4 className="text-sm font-semibold text-slate-700">Daily Tasks</h4>
                <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: form.daily_tasks }} />
              </div>
            )}
            {form.required_skills?.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-slate-700">Skills</h4>
                <div className="flex flex-wrap gap-1.5">
                  {form.required_skills.map((s) => <Badge key={s}>{s}</Badge>)}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showSaveTemplate} onOpenChange={setShowSaveTemplate}>
        <DialogContent title="Save as Template" description="Reuse this vacancy's fields as a starting point for future postings.">
          <Label>Template Name</Label>
          <Input value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="e.g. Standard Software Engineer posting" />
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setShowSaveTemplate(false)}>Cancel</Button>
            <Button size="sm" disabled={!templateName.trim() || actionLoading === 'save-template'} onClick={saveAsTemplate}>
              {actionLoading === 'save-template' ? 'Saving…' : 'Save Template'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
