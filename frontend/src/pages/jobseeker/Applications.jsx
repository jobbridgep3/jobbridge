import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { motion } from 'framer-motion'
import { Building2, Calendar, ClipboardList, Download, Eye, FileDown, Search, Send, Upload, X } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { Link } from 'react-router-dom'

import { ApplicationTimeline } from '../../components/application/ApplicationTimeline'
import { Button } from '../../components/ui/Button'
import { Card, CardContent } from '../../components/ui/Card'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { DatePicker } from '../../components/ui/DatePicker'
import { Dialog, DialogContent } from '../../components/ui/Dialog'
import { EmptyState } from '../../components/ui/EmptyState'
import { Input, Label, Select, Textarea } from '../../components/ui/Input'
import { PageHeader } from '../../components/ui/PageHeader'
import { CardSkeleton } from '../../components/ui/Skeleton'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { useSocket } from '../../hooks/useSocket'
import api from '../../lib/axios'
import { downloadFile, parseBlobError } from '../../lib/download'
import { fadeIn, staggerContainer, staggerItem } from '../../lib/motion'
import { cn } from '../../lib/utils'

const STATUS_OPTIONS = [
  { value: 'applied', label: 'Application Submitted' },
  { value: 'under_review', label: 'Documents Under Review' },
  { value: 'shortlisted', label: 'Shortlisted' },
  { value: 'interview_scheduled', label: 'Interview Scheduled' },
  { value: 'interview_completed', label: 'Interview Completed' },
  { value: 'background_verification', label: 'Background Verification' },
  { value: 'offer_extended', label: 'Job Offer' },
  { value: 'hired', label: 'Hired' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Withdrawn' },
]

const WITHDRAWABLE = ['applied', 'under_review']

function CompanyLogo({ url, name }) {
  if (url) {
    return <img src={url} alt={name} className="h-11 w-11 shrink-0 rounded-lg border border-slate-200 bg-white object-contain" />
  }
  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50">
      <Building2 className="h-5 w-5 text-slate-400" />
    </div>
  )
}

function MessagesPanel({ applicationId }) {
  const queryClient = useQueryClient()
  const [body, setBody] = useState('')
  const { data: messages, isLoading } = useQuery({
    queryKey: ['applications', applicationId, 'messages'],
    queryFn: async () => (await api.get(`/api/applications/${applicationId}/messages`)).data.data,
    enabled: !!applicationId,
  })
  useSocket({
    'application:message': () => queryClient.invalidateQueries({ queryKey: ['applications', applicationId, 'messages'] }),
  })
  const send = useMutation({
    mutationFn: () => api.post(`/api/applications/${applicationId}/messages`, { body: body.trim() }),
    onSuccess: () => {
      setBody('')
      queryClient.invalidateQueries({ queryKey: ['applications', applicationId, 'messages'] })
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not send message.'),
  })

  return (
    <div className="space-y-3">
      <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg bg-slate-50 p-3">
        {isLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : !messages?.length ? (
          <p className="py-4 text-center text-sm text-slate-500">No messages from the employer yet.</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={cn('flex', m.sender_role === 'jobseeker' ? 'justify-end' : 'justify-start')}>
              <div
                className={cn(
                  'max-w-[75%] rounded-xl px-3 py-2 text-sm',
                  m.sender_role === 'jobseeker' ? 'bg-primary-800 text-white' : 'border border-slate-200 bg-white text-slate-800',
                )}
              >
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p className={cn('mt-1 text-[10px]', m.sender_role === 'jobseeker' ? 'text-primary-200' : 'text-slate-400')}>
                  {dayjs(m.created_at).format('MMM D, h:mm A')}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
      <div className="flex gap-2">
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write a message…" className="min-h-[44px] flex-1" />
        <Button size="sm" onClick={() => send.mutate()} disabled={!body.trim() || send.isPending}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

function DocumentRequestRow({ request, applicationId }) {
  const queryClient = useQueryClient()
  const fileRef = useRef(null)
  const [uploading, setUploading] = useState(false)

  const upload = async (file) => {
    if (!file) return
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      await api.put(`/api/document-requests/${request.id}/submit`, form, { headers: { 'Content-Type': 'multipart/form-data' } })
      toast.success('Document submitted — employer notified.')
      queryClient.invalidateQueries({ queryKey: ['applications', applicationId] })
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not upload document.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-3">
      <div>
        <p className="text-sm font-medium text-slate-800">{request.document_label}</p>
        <p className="text-xs text-slate-500">
          Requested {dayjs(request.created_at).format('MMM D, YYYY')}
          {request.note ? ` · ${request.note}` : ''}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <StatusBadge status={request.status} />
        {request.status === 'pending' && (
          <>
            <input ref={fileRef} type="file" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
            <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()} disabled={uploading}>
              <Upload className="h-3.5 w-3.5" /> {uploading ? 'Uploading…' : 'Upload'}
            </Button>
          </>
        )}
        {request.submitted_document && (
          <Button size="sm" variant="secondary" onClick={() => window.open(request.submitted_document.file_url, '_blank')}>
            <Download className="h-3.5 w-3.5" /> View
          </Button>
        )}
      </div>
    </div>
  )
}

function OfferCard({ offer, applicationId }) {
  const queryClient = useQueryClient()
  const respond = useMutation({
    mutationFn: (action) => api.put(`/api/offers/${offer.id}/respond`, { action }),
    onSuccess: (_res, action) => {
      toast.success(action === 'accept' ? 'Offer accepted — the employer has been notified!' : 'Offer declined — the employer has been notified.')
      queryClient.invalidateQueries({ queryKey: ['applications', applicationId] })
      queryClient.invalidateQueries({ queryKey: ['applications'] })
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not respond to offer.'),
  })

  return (
    <div className="rounded-lg border border-primary-200 bg-primary-50/50 p-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-900">Job Offer — {offer.position}</h4>
        <StatusBadge status={offer.status} label={offer.status === 'offered' ? 'Awaiting Your Response' : undefined} />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
        <div>
          <p className="text-xs text-slate-500">Salary</p>
          <p className="font-medium">{offer.salary_offer != null ? `PHP ${Number(offer.salary_offer).toLocaleString()}` : 'As discussed'}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Type</p>
          <p className="font-medium capitalize">{offer.employment_type?.replace(/_/g, ' ') || '—'}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Start Date</p>
          <p className="font-medium">{offer.start_date ? dayjs(offer.start_date).format('MMM D, YYYY') : 'To be arranged'}</p>
        </div>
      </div>
      {offer.terms && <p className="mt-2 text-sm text-slate-600">{offer.terms}</p>}
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        {offer.pdf_url && (
          <Button size="sm" variant="secondary" onClick={() => window.open(offer.pdf_url, '_blank')}>
            <Download className="h-3.5 w-3.5" /> Offer Letter
          </Button>
        )}
        {offer.status === 'offered' && (
          <>
            <Button size="sm" variant="ghost" onClick={() => respond.mutate('decline')} disabled={respond.isPending}>
              Decline Offer
            </Button>
            <Button size="sm" onClick={() => respond.mutate('accept')} disabled={respond.isPending}>
              Accept Offer
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

function ReferralLettersPanel() {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({ vacancy_id: '', reason: '' })

  const { data: letters, isLoading } = useQuery({
    queryKey: ['referral-letters', 'my'],
    queryFn: async () => (await api.get('/api/referral-letters/my')).data.data,
  })
  const { data: jobs } = useQuery({
    queryKey: ['jobs', 'for-referral'],
    queryFn: async () => (await api.get('/api/jobs')).data.data,
  })

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['referral-letters', 'my'] })
  useSocket({
    'referral:ready': refresh,
    'referral:decision': refresh,
  })

  const requestLetter = useMutation({
    mutationFn: () => api.post('/api/referral-letters', { vacancy_id: form.vacancy_id || null, reason: form.reason.trim() || null }),
    onSuccess: () => {
      toast.success('Request sent to PESO — you will be notified once reviewed.')
      setForm({ vacancy_id: '', reason: '' })
      refresh()
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not send request.'),
  })

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Request a Referral Letter</h3>
            <p className="text-xs text-slate-500">
              PESO staff will review your request. Once approved, the letter attaches automatically when you apply to the matching job.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label>For Job Vacancy (optional)</Label>
              <Select value={form.vacancy_id} onChange={(e) => setForm({ ...form, vacancy_id: e.target.value })}>
                <option value="">General referral (any employer)</option>
                {(jobs || []).map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.title} — {j.company_name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Purpose / Reason</Label>
              <Input
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                placeholder="e.g. Required by the employer for my application"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button size="sm" onClick={() => requestLetter.mutate()} disabled={requestLetter.isPending}>
              {requestLetter.isPending ? 'Sending…' : 'Request Referral Letter'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <CardSkeleton />
      ) : !letters?.length ? (
        <EmptyState icon={ClipboardList} title="No referral letters yet" description="Your referral letter requests will appear here." />
      ) : (
        <div className="space-y-3">
          {letters.map((letter) => (
            <Card key={letter.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {letter.job_title ? `${letter.job_title} — ${letter.company_name}` : 'General referral letter'}
                  </p>
                  <p className="text-xs text-slate-500">
                    Requested {dayjs(letter.created_at).format('MMM D, YYYY')}
                    {letter.reason ? ` · ${letter.reason}` : ''}
                  </p>
                  {letter.status === 'rejected' && letter.rejection_reason && (
                    <p className="mt-0.5 text-xs text-red-600">Reason: {letter.rejection_reason}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={letter.status} label={letter.status === 'requested' ? 'Pending Review' : undefined} />
                  {letter.pdf_url && (
                    <Button size="sm" variant="secondary" onClick={() => window.open(letter.pdf_url, '_blank')}>
                      <Download className="h-3.5 w-3.5" /> Download
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function ApplicationDetailDialog({ applicationId, onClose, onWithdraw }) {
  const [tab, setTab] = useState('overview')
  const { data: detail, isLoading } = useQuery({
    queryKey: ['applications', applicationId],
    queryFn: async () => (await api.get(`/api/applications/${applicationId}`)).data.data,
    enabled: !!applicationId,
  })

  const closeAndReset = () => {
    setTab('overview')
    onClose()
  }

  return (
    <Dialog open={!!applicationId} onOpenChange={(open) => !open && closeAndReset()}>
      <DialogContent title="Application Details" className="max-w-2xl">
        {isLoading || !detail ? (
          <CardSkeleton />
        ) : (
          <div className="max-h-[70vh] space-y-5 overflow-y-auto pr-1">
            <div className="flex items-start gap-3">
              <CompanyLogo url={detail.company_logo_url} name={detail.company_name} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900">{detail.job_title}</p>
                <p className="text-sm text-slate-500">{detail.company_name}</p>
                <div className="mt-1.5">
                  <StatusBadge status={detail.status} label={detail.status_label} />
                </div>
              </div>
            </div>

            <div className="flex gap-1 rounded-lg border border-slate-200 p-1">
              {[
                { key: 'overview', label: 'Overview' },
                { key: 'messages', label: 'Messages' },
              ].map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={cn(
                    'flex-1 rounded-md px-3 py-1.5 text-sm font-medium',
                    tab === t.key ? 'bg-primary-800 text-white' : 'text-slate-600 hover:bg-slate-100',
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {tab === 'messages' && <MessagesPanel applicationId={applicationId} />}

            {tab === 'overview' && (
              <>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 rounded-lg bg-slate-50 p-4 text-sm sm:grid-cols-3">
              <div>
                <p className="text-xs text-slate-500">Reference No.</p>
                <p className="font-medium text-slate-800">{detail.reference_no}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Date Applied</p>
                <p className="font-medium text-slate-800">{dayjs(detail.created_at).format('MMM D, YYYY')}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Last Updated</p>
                <p className="font-medium text-slate-800">{dayjs(detail.updated_at).format('MMM D, YYYY')}</p>
              </div>
              <div className="col-span-2 sm:col-span-3">
                <p className="text-xs text-slate-500">HR Representative</p>
                <p className="font-medium text-slate-800">
                  {detail.hr_representative
                    ? `${detail.hr_representative.full_name}${detail.hr_representative.position ? ` — ${detail.hr_representative.position}` : ''}`
                    : 'Not assigned yet'}
                </p>
              </div>
            </div>

            {detail.interviews?.length > 0 && (
              <div>
                <h4 className="mb-2 text-sm font-semibold text-slate-900">Interview Schedule</h4>
                <div className="space-y-2">
                  {detail.interviews.map((iv) => (
                    <div key={iv.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-3 text-sm">
                      <div>
                        <p className="font-medium text-slate-800">
                          <Calendar className="mr-1 inline h-3.5 w-3.5 text-slate-400" />
                          {dayjs(iv.scheduled_date).format('MMM D, YYYY h:mm A')}
                        </p>
                        <p className="text-xs capitalize text-slate-500">
                          {iv.mode}
                          {iv.location ? ` · ${iv.location}` : ''}
                        </p>
                      </div>
                      <StatusBadge status={iv.status} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {detail.feedback_note && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs font-semibold text-amber-800">Message from the employer</p>
                <p className="mt-0.5 text-sm text-amber-900">{detail.feedback_note}</p>
              </div>
            )}

            {detail.job_offer && detail.job_offer.status !== 'withdrawn' && (
              <OfferCard offer={detail.job_offer} applicationId={applicationId} />
            )}

            {detail.document_requests?.length > 0 && (
              <div>
                <h4 className="mb-2 text-sm font-semibold text-slate-900">Requested Documents</h4>
                <div className="space-y-2">
                  {detail.document_requests
                    .filter((r) => r.status !== 'cancelled')
                    .map((r) => (
                      <DocumentRequestRow key={r.id} request={r} applicationId={applicationId} />
                    ))}
                </div>
              </div>
            )}

            <div>
              <h4 className="mb-2 text-sm font-semibold text-slate-900">Application Timeline</h4>
              <ApplicationTimeline events={detail.timeline} />
            </div>

            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-3">
              {detail.referral_letter?.pdf_url && (
                <Button size="sm" variant="secondary" onClick={() => window.open(detail.referral_letter.pdf_url, '_blank')}>
                  <Download className="h-3.5 w-3.5" /> Referral Letter
                </Button>
              )}
              {detail.status === 'interview_scheduled' && (
                <Button size="sm" variant="secondary" asChild>
                  <Link to="/jobseeker/interviews">View Interview</Link>
                </Button>
              )}
              {WITHDRAWABLE.includes(detail.status) && (
                <Button size="sm" variant="ghost" onClick={() => onWithdraw(detail.id)}>
                  <X className="h-3.5 w-3.5" /> Withdraw Application
                </Button>
              )}
            </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default function JobseekerApplications() {
  const queryClient = useQueryClient()
  const [view, setView] = useState('applications')
  const [withdrawTarget, setWithdrawTarget] = useState(null)
  const [detailId, setDetailId] = useState(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [companyFilter, setCompanyFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [exporting, setExporting] = useState(false)

  const { data: applications, isLoading } = useQuery({
    queryKey: ['applications'],
    queryFn: async () => (await api.get('/api/applications')).data.data,
  })

  useSocket({
    'application:status_update': () => queryClient.invalidateQueries({ queryKey: ['applications'] }),
    'referral:ready': () => queryClient.invalidateQueries({ queryKey: ['applications'] }),
    'application:document_request': () => queryClient.invalidateQueries({ queryKey: ['applications'] }),
    'offer:new': () => queryClient.invalidateQueries({ queryKey: ['applications'] }),
    'offer:response': () => queryClient.invalidateQueries({ queryKey: ['applications'] }),
  })

  const companies = useMemo(
    () => [...new Set((applications || []).map((a) => a.company_name).filter(Boolean))].sort(),
    [applications],
  )

  const filtered = useMemo(() => {
    return (applications || []).filter((app) => {
      if (search) {
        const q = search.toLowerCase()
        const haystack = `${app.job_title || ''} ${app.company_name || ''} ${app.reference_no || ''}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      if (statusFilter && app.status !== statusFilter) return false
      if (companyFilter && app.company_name !== companyFilter) return false
      if (dateFrom && dayjs(app.created_at).isBefore(dayjs(dateFrom), 'day')) return false
      if (dateTo && dayjs(app.created_at).isAfter(dayjs(dateTo), 'day')) return false
      return true
    })
  }, [applications, search, statusFilter, companyFilter, dateFrom, dateTo])

  const clearFilters = () => {
    setSearch('')
    setStatusFilter('')
    setCompanyFilter('')
    setDateFrom('')
    setDateTo('')
  }

  const withdrawApplication = async () => {
    try {
      await api.delete(`/api/applications/${withdrawTarget}`)
      toast.success('Application withdrawn.')
      queryClient.invalidateQueries({ queryKey: ['applications'] })
      setDetailId(null)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not withdraw application.')
    } finally {
      setWithdrawTarget(null)
    }
  }

  const exportPdf = async () => {
    setExporting(true)
    try {
      await downloadFile('/api/applications/export/pdf', { filename: 'my-applications.pdf' })
    } catch (err) {
      toast.error(await parseBlobError(err))
    } finally {
      setExporting(false)
    }
  }

  return (
    <motion.div {...fadeIn} className="space-y-4">
      <PageHeader
        title="My Applications"
        description="Track the status of every job you've applied to, updated in real time."
        actions={
          view === 'applications' && applications?.length ? (
            <Button variant="secondary" size="sm" onClick={exportPdf} disabled={exporting}>
              <FileDown className="h-4 w-4" /> {exporting ? 'Exporting…' : 'Export PDF'}
            </Button>
          ) : null
        }
      />

      <div className="flex w-fit rounded-lg border border-slate-200 bg-white p-0.5">
        {[
          { key: 'applications', label: 'Applications' },
          { key: 'referrals', label: 'Referral Letters' },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setView(t.key)}
            className={cn(
              'rounded-md px-4 py-1.5 text-sm font-medium',
              view === t.key ? 'bg-primary-800 text-white' : 'text-slate-600 hover:bg-slate-100',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {view === 'referrals' && <ReferralLettersPanel />}

      {view === 'applications' && (
      <>
      <Card>
        <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <div className="col-span-2 md:col-span-1">
            <Label>Search</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input className="pl-8" placeholder="Job, company, ref no." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All statuses</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Company</Label>
            <Select value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)}>
              <option value="">All companies</option>
              {companies.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Applied From</Label>
            <DatePicker value={dateFrom} onChange={setDateFrom} />
          </div>
          <div>
            <Label>Applied To</Label>
            <DatePicker value={dateTo} onChange={setDateTo} />
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <CardSkeleton />
      ) : !applications?.length ? (
        <EmptyState
          icon={ClipboardList}
          title="No applications yet"
          description="Browse jobs and apply to start tracking your applications here."
          actionLabel="Search Jobs"
          onAction={() => (window.location.href = '/jobseeker/jobs')}
        />
      ) : !filtered.length ? (
        <EmptyState
          icon={Search}
          title="No matching applications"
          description="Try adjusting your search or filters."
          actionLabel="Clear Filters"
          onAction={clearFilters}
        />
      ) : (
        <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-3">
          {filtered.map((app) => (
            <motion.div key={app.id} variants={staggerItem}>
              <Card>
                <CardContent className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <CompanyLogo url={app.company_logo_url} name={app.company_name} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{app.job_title}</p>
                      <p className="truncate text-xs text-slate-500">{app.company_name}</p>
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {app.reference_no} · Applied {dayjs(app.created_at).format('MMM D, YYYY')} · Updated{' '}
                        {dayjs(app.updated_at).format('MMM D, YYYY')}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={app.status} label={app.status_label} />
                    <Button size="sm" variant="secondary" onClick={() => setDetailId(app.id)}>
                      <Eye className="h-3.5 w-3.5" /> Details
                    </Button>
                    {WITHDRAWABLE.includes(app.status) && (
                      <Button size="sm" variant="ghost" onClick={() => setWithdrawTarget(app.id)}>
                        <X className="h-3.5 w-3.5" /> Withdraw
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}

      </>
      )}

      <ApplicationDetailDialog applicationId={detailId} onClose={() => setDetailId(null)} onWithdraw={(id) => setWithdrawTarget(id)} />

      <ConfirmDialog
        open={!!withdrawTarget}
        onOpenChange={(open) => !open && setWithdrawTarget(null)}
        title="Withdraw this application?"
        description="The employer will be notified. This action cannot be undone."
        confirmLabel="Withdraw Application"
        danger
        onConfirm={withdrawApplication}
      />
    </motion.div>
  )
}
