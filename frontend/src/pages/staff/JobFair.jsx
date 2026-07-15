import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { motion } from 'framer-motion'
import { Archive, Download, ImagePlus, Pencil, Plus, QrCode, Send, Trash2, XCircle } from 'lucide-react'
import { useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { Link } from 'react-router-dom'

import { Button } from '../../components/ui/Button'
import { Card, CardContent } from '../../components/ui/Card'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Dialog, DialogContent } from '../../components/ui/Dialog'
import { EmptyState } from '../../components/ui/EmptyState'
import { Input, Label, Textarea } from '../../components/ui/Input'
import { PageHeader } from '../../components/ui/PageHeader'
import { CardSkeleton } from '../../components/ui/Skeleton'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { useSocket } from '../../hooks/useSocket'
import api from '../../lib/axios'
import { downloadFile, parseBlobError } from '../../lib/download'
import { fadeIn, staggerContainer, staggerItem } from '../../lib/motion'
import { cn } from '../../lib/utils'

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
  useSocket({ 'jobfair:qr_scanned': refresh })

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

  const downloadAttendanceReport = async (fairId, format = 'excel') => {
    try {
      await downloadFile(`/api/staff/jobfair/${fairId}/attendance-report`, {
        params: { format },
        filename: format === 'pdf' ? 'jobfair_attendance.pdf' : 'jobfair_attendance.xlsx',
      })
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
                {fair.banner_url && <img src={fair.banner_url} alt={fair.name} className="h-32 w-full object-cover" />}
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
                    {fair.registered_jobseekers > 0 && (
                      <Button size="sm" variant="secondary" onClick={() => downloadAttendanceReport(fair.id)}>
                        <Download className="h-3.5 w-3.5" /> Attendance
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Starts</Label>
                <Input type="datetime-local" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} />
              </div>
              <div>
                <Label>Ends (optional)</Label>
                <Input type="datetime-local" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Registration Deadline (optional)</Label>
              <Input
                type="datetime-local"
                value={form.registration_deadline}
                onChange={(e) => setForm({ ...form, registration_deadline: e.target.value })}
              />
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
