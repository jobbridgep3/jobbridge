import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import { motion } from 'framer-motion'
import { Archive, Check, Download, FileBarChart, FileDown, ImagePlus, Pencil, Plus, QrCode, Send, Store, Trash2, X, XCircle } from 'lucide-react'
import { useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { Link } from 'react-router-dom'

import { Button } from '../../components/ui/Button'
import { Card, CardContent } from '../../components/ui/Card'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { DatePicker } from '../../components/ui/DatePicker'
import { Dialog, DialogContent } from '../../components/ui/Dialog'
import { EmptyState } from '../../components/ui/EmptyState'
import { Input, Label, Textarea } from '../../components/ui/Input'
import { PageHeader } from '../../components/ui/PageHeader'
import { CardSkeleton } from '../../components/ui/Skeleton'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { TimePicker } from '../../components/ui/TimePicker'
import { useSocket } from '../../hooks/useSocket'
import api from '../../lib/axios'
import { downloadFile, parseBlobError } from '../../lib/download'
import { fadeIn, staggerContainer, staggerItem } from '../../lib/motion'
import { cn } from '../../lib/utils'

dayjs.extend(customParseFormat)

function splitScheduledDate(value) {
  const [date = '', time24 = ''] = (value || '').split('T')
  const time = time24 ? dayjs(time24, 'HH:mm').format('h:mm A') : ''
  return { date, time }
}
function joinScheduledDate(date, time) {
  if (!date) return ''
  const time24 = time ? dayjs(time, 'h:mm A').format('HH:mm') : '00:00'
  return `${date}T${time24}`
}

const STATUS_TABS = [
  { key: '', label: 'All' },
  { key: 'draft', label: 'Drafts' },
  { key: 'published', label: 'Published' },
  { key: 'ongoing', label: 'Ongoing' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'archived', label: 'Archived' },
]

const EMPTY_FORM = {
  name: '', description: '', venue: '', municipality: '', event_date: '', end_time: '',
  registration_deadline: '', max_employer_slots: 20, max_jobseeker_slots: 200,
  contact_person: '', contact_number: '', requirements: '',
}

function fairToForm(fair) {
  const toLocal = (iso) => (iso ? dayjs(iso).format('YYYY-MM-DDTHH:mm') : '')
  return {
    name: fair.name || '',
    description: fair.description || '',
    venue: fair.venue || '',
    municipality: fair.municipality || '',
    event_date: toLocal(fair.event_date),
    end_time: toLocal(fair.end_time),
    registration_deadline: toLocal(fair.registration_deadline),
    max_employer_slots: fair.max_employer_slots ?? 20,
    max_jobseeker_slots: fair.max_jobseeker_slots ?? 200,
    contact_person: fair.contact_person || '',
    contact_number: fair.contact_number || '',
    requirements: fair.requirements || '',
  }
}

function BoothsDialog({ fair, onClose }) {
  const queryClient = useQueryClient()
  const [remarksTarget, setRemarksTarget] = useState(null) // { booth, action: 'reject' | 'suspend' }
  const [remarks, setRemarks] = useState('')

  const { data: detail, isLoading } = useQuery({
    queryKey: ['jobfair', fair.id, 'detail'],
    queryFn: async () => (await api.get(`/api/jobfair/${fair.id}`)).data.data,
  })
  const booths = detail?.booths || []

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['jobfair', fair.id, 'detail'] })
    queryClient.invalidateQueries({ queryKey: ['jobfair'] })
  }

  const review = useMutation({
    mutationFn: ({ boothId, action, reason }) =>
      api.put(`/api/staff/jobfair/${fair.id}/booths/${boothId}/${action}`, reason ? { remarks: reason } : undefined),
    onSuccess: (res) => {
      toast.success(res.data?.message || 'Booth updated.')
      setRemarksTarget(null)
      setRemarks('')
      refresh()
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not update booth.'),
  })

  const isRowPending = (boothId) => review.isPending && review.variables?.boothId === boothId

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent title={`Manage Booths — ${fair.name}`} className="max-w-2xl">
        {isLoading ? (
          <CardSkeleton />
        ) : !booths.length ? (
          <p className="py-4 text-center text-sm text-slate-500">No booth requests for this job fair yet.</p>
        ) : (
          <div className="max-h-[65vh] space-y-2 overflow-y-auto pr-1">
            {booths.map((b) => (
              <div key={b.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{b.company_name}</p>
                    <p className="text-xs text-slate-500">{b.booth_name}</p>
                  </div>
                  <StatusBadge status={b.status} />
                </div>
                {b.review_remarks && <p className="mt-1 text-xs text-red-600">Reason: {b.review_remarks}</p>}
                <div className="mt-2 flex flex-wrap gap-2">
                  {b.status === 'pending' && (
                    <>
                      <Button size="sm" disabled={isRowPending(b.id)} onClick={() => review.mutate({ boothId: b.id, action: 'approve' })}>
                        <Check className="h-3.5 w-3.5" /> {isRowPending(b.id) ? 'Approving…' : 'Approve'}
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => setRemarksTarget({ booth: b, action: 'reject' })}>
                        <X className="h-3.5 w-3.5" /> Reject
                      </Button>
                    </>
                  )}
                  {b.status === 'confirmed' && (
                    <Button size="sm" variant="danger" onClick={() => setRemarksTarget({ booth: b, action: 'suspend' })}>
                      <X className="h-3.5 w-3.5" /> Suspend
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>

      <Dialog open={!!remarksTarget} onOpenChange={(open) => !open && setRemarksTarget(null)}>
        <DialogContent title={remarksTarget?.action === 'reject' ? 'Reject Booth Request' : 'Suspend Booth'}>
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              {remarksTarget?.action === 'reject' ? 'Rejecting' : 'Suspending'} the booth for <b>{remarksTarget?.booth.company_name}</b>.
              The employer will be notified with your reason.
            </p>
            <div>
              <Label>Reason</Label>
              <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Why is this booth being rejected/suspended?" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setRemarksTarget(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                disabled={!remarks.trim() || isRowPending(remarksTarget?.booth.id)}
                onClick={() => review.mutate({ boothId: remarksTarget.booth.id, action: remarksTarget.action, reason: remarks.trim() })}
              >
                {isRowPending(remarksTarget?.booth.id) ? 'Submitting…' : remarksTarget?.action === 'reject' ? 'Reject Booth' : 'Suspend Booth'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}

export default function StaffJobFair({ basePath = '/staff' }) {
  const queryClient = useQueryClient()
  const [statusTab, setStatusTab] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null) // fair being edited, or null = creating
  const [form, setForm] = useState(EMPTY_FORM)
  const [confirm, setConfirm] = useState(null) // { action, fair }
  const bannerRef = useRef(null)
  const [bannerTarget, setBannerTarget] = useState(null)

  const { data: fairs, isLoading } = useQuery({
    queryKey: ['jobfair', 'staff', statusTab],
    queryFn: async () => (await api.get('/api/jobfair', { params: statusTab ? { status: statusTab } : {} })).data.data,
  })

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['jobfair'] })
  useSocket({ 'jobfair:qr_scanned': refresh, 'jobfair:booth_requested': refresh })

  const saveFair = useMutation({
    mutationFn: () => (editing ? api.put(`/api/staff/jobfair/${editing.id}`, form) : api.post('/api/staff/jobfair', form)),
    onSuccess: () => {
      toast.success(editing ? 'Job fair updated.' : 'Draft created — publish it when ready.')
      setFormOpen(false)
      refresh()
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not save job fair.'),
  })

  const lifecycle = useMutation({
    mutationFn: ({ action, fair }) =>
      action === 'delete' ? api.delete(`/api/staff/jobfair/${fair.id}`) : api.post(`/api/staff/jobfair/${fair.id}/${action}`),
    onSuccess: (res, { action }) => {
      toast.success(res.data?.message || `Job fair ${action}d.`)
      refresh()
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Action failed.'),
  })

  const uploadBanner = async (file) => {
    if (!file || !bannerTarget) return
    try {
      const formData = new FormData()
      formData.append('file', file)
      await api.post(`/api/staff/jobfair/${bannerTarget}/banner`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      toast.success('Banner uploaded.')
      refresh()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not upload banner.')
    } finally {
      setBannerTarget(null)
    }
  }

  const [reportsFair, setReportsFair] = useState(null)
  const [boothsFair, setBoothsFair] = useState(null)

  const downloadReport = async (fairId, type, format) => {
    try {
      if (type === 'attendance') {
        await downloadFile(`/api/staff/jobfair/${fairId}/attendance-report`, {
          params: { format },
          filename: format === 'pdf' ? 'jobfair_attendance.pdf' : 'jobfair_attendance.xlsx',
        })
      } else {
        await downloadFile(`/api/staff/jobfair/${fairId}/report`, {
          params: { type, format },
          filename: format === 'pdf' ? `jobfair_${type}.pdf` : `jobfair_${type}.xlsx`,
        })
      }
    } catch (err) {
      toast.error(await parseBlobError(err))
    }
  }

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormOpen(true)
  }
  const openEdit = (fair) => {
    setEditing(fair)
    setForm(fairToForm(fair))
    setFormOpen(true)
  }

  const confirmCopy = {
    publish: { title: 'Publish this job fair?', description: 'All jobseekers and employers will receive a website and email notification.', label: 'Publish' },
    archive: { title: 'Archive this job fair?', description: 'It will be hidden from active lists but its records are kept for reporting.', label: 'Archive' },
    cancel: { title: 'Cancel this job fair?', description: 'All registered participants will be notified of the cancellation.', label: 'Cancel Event' },
    delete: { title: 'Delete this draft?', description: 'This draft and its data will be permanently removed.', label: 'Delete Draft' },
  }

  return (
    <motion.div {...fadeIn} className="space-y-4">
      <PageHeader
        title="Job Fair Management"
        description="Create, publish, and operate PESO job fair events — including QR attendance and reports."
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Create Job Fair
          </Button>
        }
      />

      <div className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-white p-1">
        {STATUS_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setStatusTab(t.key)}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-medium',
              statusTab === t.key ? 'bg-primary-800 text-white' : 'text-slate-600 hover:bg-slate-100',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <CardSkeleton />
      ) : !fairs?.length ? (
        <EmptyState icon={QrCode} title="No job fairs in this view" description="Create a job fair to get started." />
      ) : (
        <motion.div variants={staggerContainer} initial="initial" animate="animate" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {fairs.map((fair) => (
            <motion.div key={fair.id} variants={staggerItem}>
              <Card className="overflow-hidden">
                {fair.banner_url && <img src={fair.banner_url} alt={fair.name} className="aspect-[16/9] w-full bg-slate-100 object-contain" />}
                <CardContent>
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-slate-900">{fair.name}</h3>
                    <StatusBadge status={fair.status} />
                  </div>
                  <p className="text-xs text-slate-500">
                    {fair.venue}
                    {fair.municipality ? `, ${fair.municipality}` : ''}
                  </p>
                  <p className="text-xs text-slate-500">
                    {dayjs(fair.event_date).format('MMM D, YYYY h:mm A')}
                    {fair.end_time ? ` – ${dayjs(fair.end_time).format('h:mm A')}` : ''}
                  </p>
                  {fair.registration_deadline && (
                    <p className="text-xs text-slate-400">Registration until {dayjs(fair.registration_deadline).format('MMM D, YYYY')}</p>
                  )}
                  <p className="mt-1 text-xs text-slate-400">
                    {fair.registered_employers} employers · {fair.registered_jobseekers} jobseekers · {fair.attended_count} attended
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {fair.status === 'draft' && (
                      <>
                        <Button size="sm" onClick={() => setConfirm({ action: 'publish', fair })}>
                          <Send className="h-3.5 w-3.5" /> Publish
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setConfirm({ action: 'delete', fair })}>
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </Button>
                      </>
                    )}
                    {['published', 'ongoing'].includes(fair.status) && (
                      <>
                        <Button size="sm" asChild>
                          <Link to={`${basePath}/jobfair/${fair.id}/scanner`}>
                            <QrCode className="h-3.5 w-3.5" /> Scanner
                          </Link>
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setConfirm({ action: 'cancel', fair })}>
                          <XCircle className="h-3.5 w-3.5" /> Cancel
                        </Button>
                      </>
                    )}
                    {fair.status !== 'archived' && (
                      <Button size="sm" variant="secondary" onClick={() => openEdit(fair)}>
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </Button>
                    )}
                    {fair.status !== 'archived' && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setBannerTarget(fair.id)
                          bannerRef.current?.click()
                        }}
                      >
                        <ImagePlus className="h-3.5 w-3.5" /> Banner
                      </Button>
                    )}
                    {['completed', 'cancelled'].includes(fair.status) && (
                      <Button size="sm" variant="ghost" onClick={() => setConfirm({ action: 'archive', fair })}>
                        <Archive className="h-3.5 w-3.5" /> Archive
                      </Button>
                    )}
                    {fair.status !== 'draft' && (
                      <Button size="sm" variant="secondary" onClick={() => setReportsFair(fair)}>
                        <FileBarChart className="h-3.5 w-3.5" /> Reports
                      </Button>
                    )}
                    {fair.status !== 'draft' && (
                      <Button size="sm" variant="secondary" onClick={() => setBoothsFair(fair)}>
                        <Store className="h-3.5 w-3.5" /> Manage Booths
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}

      <input ref={bannerRef} type="file" accept="image/*" className="hidden" onChange={(e) => uploadBanner(e.target.files?.[0])} />

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent title={editing ? 'Edit Job Fair' : 'Create Job Fair'} className="max-w-2xl">
          <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
            <div>
              <Label>Event Title</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Venue</Label>
                <Input value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} />
              </div>
              <div>
                <Label>Municipality</Label>
                <Input value={form.municipality} onChange={(e) => setForm({ ...form, municipality: e.target.value })} placeholder="e.g. Pila" />
              </div>
            </div>
            <div>
              <Label>Starts</Label>
              <div className="grid grid-cols-2 gap-3">
                <DatePicker
                  value={splitScheduledDate(form.event_date).date}
                  onChange={(date) => setForm({ ...form, event_date: joinScheduledDate(date, splitScheduledDate(form.event_date).time) })}
                />
                <TimePicker
                  value={splitScheduledDate(form.event_date).time}
                  onChange={(time) => setForm({ ...form, event_date: joinScheduledDate(splitScheduledDate(form.event_date).date, time) })}
                />
              </div>
            </div>
            <div>
              <Label>Ends (optional)</Label>
              <div className="grid grid-cols-2 gap-3">
                <DatePicker
                  value={splitScheduledDate(form.end_time).date}
                  onChange={(date) => setForm({ ...form, end_time: joinScheduledDate(date, splitScheduledDate(form.end_time).time) })}
                />
                <TimePicker
                  value={splitScheduledDate(form.end_time).time}
                  onChange={(time) => setForm({ ...form, end_time: joinScheduledDate(splitScheduledDate(form.end_time).date, time) })}
                />
              </div>
            </div>
            <div>
              <Label>Registration Deadline (optional)</Label>
              <div className="grid grid-cols-2 gap-3">
                <DatePicker
                  value={splitScheduledDate(form.registration_deadline).date}
                  onChange={(date) =>
                    setForm({ ...form, registration_deadline: joinScheduledDate(date, splitScheduledDate(form.registration_deadline).time) })
                  }
                />
                <TimePicker
                  value={splitScheduledDate(form.registration_deadline).time}
                  onChange={(time) =>
                    setForm({ ...form, registration_deadline: joinScheduledDate(splitScheduledDate(form.registration_deadline).date, time) })
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Max Employer Slots</Label>
                <Input type="number" min="1" value={form.max_employer_slots} onChange={(e) => setForm({ ...form, max_employer_slots: e.target.value })} />
              </div>
              <div>
                <Label>Max Jobseeker Slots</Label>
                <Input type="number" min="1" value={form.max_jobseeker_slots} onChange={(e) => setForm({ ...form, max_jobseeker_slots: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Contact Person</Label>
                <Input value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} />
              </div>
              <div>
                <Label>Contact Number</Label>
                <Input value={form.contact_number} onChange={(e) => setForm({ ...form, contact_number: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Requirements (what attendees should bring)</Label>
              <Textarea
                value={form.requirements}
                onChange={(e) => setForm({ ...form, requirements: e.target.value })}
                placeholder="e.g. Updated resume, valid ID, ballpen"
              />
            </div>
            <div className="flex justify-end">
              <Button
                onClick={() => saveFair.mutate()}
                disabled={!form.name.trim() || !form.venue.trim() || !form.event_date || saveFair.isPending}
              >
                {saveFair.isPending ? 'Saving…' : editing ? 'Save Changes' : 'Create Draft'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!reportsFair} onOpenChange={(open) => !open && setReportsFair(null)}>
        <DialogContent title={reportsFair ? `Reports — ${reportsFair.name}` : 'Reports'}>
          <div className="space-y-2">
            {[
              { type: 'attendance', label: 'Attendance Report' },
              { type: 'participants', label: 'Participant Report' },
              { type: 'employers', label: 'Employer Participation Report' },
              { type: 'vacancies', label: 'Vacancy Report' },
            ].map((r) => (
              <div key={r.type} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                <p className="text-sm font-medium text-slate-800">{r.label}</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => downloadReport(reportsFair.id, r.type, 'excel')}>
                    <Download className="h-3.5 w-3.5" /> Excel
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => downloadReport(reportsFair.id, r.type, 'pdf')}>
                    <FileDown className="h-3.5 w-3.5" /> PDF
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {boothsFair && <BoothsDialog fair={boothsFair} onClose={() => setBoothsFair(null)} />}

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={confirm ? confirmCopy[confirm.action].title : ''}
        description={confirm ? confirmCopy[confirm.action].description : ''}
        confirmLabel={confirm ? confirmCopy[confirm.action].label : ''}
        danger={confirm && ['cancel', 'delete'].includes(confirm.action)}
        onConfirm={() => {
          lifecycle.mutate(confirm)
          setConfirm(null)
        }}
      />
    </motion.div>
  )
}
