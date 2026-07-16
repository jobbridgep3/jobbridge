import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { motion } from 'framer-motion'
import { CalendarDays, Download, MapPinned, Paperclip, Upload, Users } from 'lucide-react'
import { useRef, useState } from 'react'
import toast from 'react-hot-toast'

import { Button } from '../../components/ui/Button'
import { Card, CardContent } from '../../components/ui/Card'
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

function fairChip(fair) {
  if (fair.status === 'published' && dayjs(fair.event_date).isAfter(dayjs())) return { status: 'upcoming' }
  return { status: fair.status }
}

function BoothDialog({ fair, onClose }) {
  const queryClient = useQueryClient()
  const fileRef = useRef(null)
  const [uploading, setUploading] = useState(false)

  const { data: detail, isLoading } = useQuery({
    queryKey: ['jobfair', fair.id],
    queryFn: async () => (await api.get(`/api/jobfair/${fair.id}`)).data.data,
  })
  const booth = detail?.my_booth
  const [form, setForm] = useState(null)
  const boothForm = form ?? { booth_name: booth?.booth_name || '', description: booth?.description || '' }

  const { data: myVacancies } = useQuery({
    queryKey: ['vacancies', 'my'],
    queryFn: async () => (await api.get('/api/vacancies/my')).data.data,
    enabled: booth?.status === 'confirmed',
  })
  const publishedVacancies = (myVacancies || []).filter((v) => v.status === 'published')

  const saveBooth = useMutation({
    mutationFn: () => api.put(`/api/jobfair/${fair.id}/booth`, boothForm),
    onSuccess: () => {
      toast.success('Booth updated.')
      queryClient.invalidateQueries({ queryKey: ['jobfair', fair.id] })
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not update booth.'),
  })

  const toggleVacancy = useMutation({
    mutationFn: ({ vacancyId, included }) =>
      api.put(`/api/vacancies/${vacancyId}/jobfair`, { jobfair_id: included ? fair.id : null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vacancies', 'my'] })
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not update vacancy.'),
  })

  const uploadMaterial = async (file) => {
    if (!file) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      await api.post(`/api/jobfair/${fair.id}/booth/materials`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      toast.success('Material uploaded.')
      queryClient.invalidateQueries({ queryKey: ['jobfair', fair.id] })
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not upload material.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent title={`Manage Booth — ${fair.name}`} className="max-w-lg">
        {isLoading ? (
          <CardSkeleton />
        ) : !booth ? (
          <p className="py-4 text-center text-sm text-slate-500">No booth registered for this fair.</p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
              <span className="text-sm text-slate-600">Booth Status</span>
              <StatusBadge status={booth.status} />
            </div>
            {booth.status === 'pending' && (
              <p className="text-xs text-slate-500">Your booth request is pending PESO review.</p>
            )}
            {['rejected', 'suspended'].includes(booth.status) && booth.review_remarks && (
              <p className="text-xs text-red-600">Reason: {booth.review_remarks}</p>
            )}
            <div>
              <Label>Booth Name</Label>
              <Input value={boothForm.booth_name} onChange={(e) => setForm({ ...boothForm, booth_name: e.target.value })} />
            </div>
            <div>
              <Label>Booth Description</Label>
              <Textarea
                value={boothForm.description}
                onChange={(e) => setForm({ ...boothForm, description: e.target.value })}
                placeholder="What your booth offers — openings, on-the-spot interviews, etc."
              />
            </div>
            <div>
              <Label>Banner / Promotional Materials</Label>
              <div className="space-y-1">
                {booth.materials?.length ? (
                  booth.materials.map((m, i) => (
                    <a key={i} href={m.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-primary-700 hover:underline">
                      <Paperclip className="h-3.5 w-3.5" /> {m.name}
                    </a>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">No materials uploaded yet.</p>
                )}
              </div>
              <input ref={fileRef} type="file" className="hidden" onChange={(e) => uploadMaterial(e.target.files?.[0])} />
              <Button size="sm" variant="secondary" className="mt-2" onClick={() => fileRef.current?.click()} disabled={uploading}>
                <Upload className="h-3.5 w-3.5" /> {uploading ? 'Uploading…' : 'Upload Material'}
              </Button>
            </div>
            {booth.status === 'confirmed' && (
              <div>
                <Label>Vacancies in this Job Fair</Label>
                {!publishedVacancies.length ? (
                  <p className="text-sm text-slate-500">You have no published vacancies to include yet.</p>
                ) : (
                  <div className="space-y-1.5">
                    {publishedVacancies.map((v) => {
                      const included = v.tagged_for_jobfair_id === fair.id
                      return (
                        <label key={v.id} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                          <input
                            type="checkbox"
                            checked={included}
                            disabled={toggleVacancy.isPending && toggleVacancy.variables?.vacancyId === v.id}
                            onChange={(e) => toggleVacancy.mutate({ vacancyId: v.id, included: e.target.checked })}
                          />
                          <span className="flex-1">{v.title}</span>
                          {v.tagged_for_jobfair_id && v.tagged_for_jobfair_id !== fair.id && (
                            <span className="text-xs text-amber-600">In another job fair</span>
                          )}
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
              <Button size="sm" onClick={() => saveBooth.mutate()} disabled={saveBooth.isPending}>
                Save Booth
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function RegistrantsDialog({ fair, onClose }) {
  const { data: registrants, isLoading, error } = useQuery({
    queryKey: ['jobfair', fair.id, 'registrants'],
    queryFn: async () => (await api.get(`/api/jobfair/${fair.id}/registrants`)).data.data,
    retry: false,
  })

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent title={`Registered Applicants — ${fair.name}`} className="max-w-2xl">
        {isLoading ? (
          <CardSkeleton />
        ) : error ? (
          <p className="py-4 text-center text-sm text-slate-500">{error.response?.data?.message || 'Could not load registrants.'}</p>
        ) : !registrants?.length ? (
          <p className="py-4 text-center text-sm text-slate-500">No jobseekers registered yet.</p>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto">
            <p className="mb-2 text-xs text-slate-500">
              {registrants.length} registered · {registrants.filter((r) => r.attended).length} attended
            </p>
            <div className="space-y-2">
              {registrants.map((r, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg border border-slate-200 p-3 text-sm">
                  <div>
                    <p className="font-medium text-slate-800">{r.jobseeker_name}</p>
                    <p className="text-xs text-slate-500">
                      {r.registration_number}
                      {r.municipality ? ` · ${r.municipality}` : ''}
                      {r.preferred_position ? ` · ${r.preferred_position}` : ''}
                    </p>
                  </div>
                  <StatusBadge status={r.attended ? 'attended' : 'accepted'} label={r.attended ? 'Attended' : 'Registered'} />
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function ParticipationsPanel() {
  const [exporting, setExporting] = useState(false)
  const { data: participations, isLoading } = useQuery({
    queryKey: ['employer', 'jobfair', 'participations'],
    queryFn: async () => (await api.get('/api/employer/jobfair/participations')).data.data,
  })

  const exportReport = async (format) => {
    setExporting(true)
    try {
      await downloadFile(`/api/employer/jobfair/export/${format}`, { filename: `jobfair_participations.${format === 'excel' ? 'xlsx' : 'pdf'}` })
    } catch (err) {
      toast.error(await parseBlobError(err))
    } finally {
      setExporting(false)
    }
  }

  if (isLoading) return <CardSkeleton />
  if (!participations?.length) {
    return <EmptyState icon={MapPinned} title="No job fair participations yet" description="Register a booth from Browse Job Fairs to get started." />
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="secondary" disabled={exporting} onClick={() => exportReport('excel')}>
          <Download className="h-3.5 w-3.5" /> Excel
        </Button>
        <Button size="sm" variant="secondary" disabled={exporting} onClick={() => exportReport('pdf')}>
          <Download className="h-3.5 w-3.5" /> PDF
        </Button>
      </div>
      {participations.map((p) => (
        <Card key={p.booth_id}>
          <CardContent className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">{p.jobfair_name}</h3>
                <p className="flex items-center gap-1.5 text-xs text-slate-500">
                  <CalendarDays className="h-3.5 w-3.5" /> {p.event_date ? dayjs(p.event_date).format('MMM D, YYYY h:mm A') : '—'} · {p.venue}
                </p>
              </div>
              <StatusBadge status={p.booth_status} />
            </div>
            {p.review_remarks && <p className="text-xs text-red-600">Reason: {p.review_remarks}</p>}
            <p className="text-xs text-slate-500">{p.assigned_vacancy_count} vacancy(ies) included in this job fair</p>
            {p.attendance_summary && (
              <div className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-2 sm:grid-cols-4">
                {[
                  ['Booth Visitors', p.attendance_summary.booth_visitors],
                  ['Interviews', p.attendance_summary.interviews],
                  ['Hired', p.attendance_summary.hired],
                  ['Applications', p.attendance_summary.total],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg bg-slate-50 px-2 py-1.5 text-center">
                    <p className="text-sm font-semibold text-slate-900">{value}</p>
                    <p className="text-xs text-slate-500">{label}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export default function EmployerJobFair() {
  const queryClient = useQueryClient()
  const [boothFair, setBoothFair] = useState(null)
  const [registrantsFair, setRegistrantsFair] = useState(null)
  const [tab, setTab] = useState('browse')

  const { data: fairs, isLoading } = useQuery({
    queryKey: ['jobfair'],
    queryFn: async () => (await api.get('/api/jobfair')).data.data,
  })

  useSocket({
    'jobfair:published': () => queryClient.invalidateQueries({ queryKey: ['jobfair'] }),
    'jobfair:updated': () => queryClient.invalidateQueries({ queryKey: ['jobfair'] }),
    'jobfair:booth_confirmed': () => queryClient.invalidateQueries({ queryKey: ['jobfair'] }),
    'jobfair:booth_rejected': () => queryClient.invalidateQueries({ queryKey: ['jobfair'] }),
    'jobfair:booth_suspended': () => queryClient.invalidateQueries({ queryKey: ['jobfair'] }),
  })

  const registerMutation = useMutation({
    mutationFn: (id) => api.post(`/api/jobfair/${id}/register-booth`),
    onSuccess: (res) => {
      toast.success(res.data.message || 'Booth request submitted — pending PESO review.')
      queryClient.invalidateQueries({ queryKey: ['jobfair'] })
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not register booth.'),
  })

  return (
    <motion.div {...fadeIn} className="space-y-4">
      <PageHeader
        title="Job Fair"
        description="Register your company, manage your booth, and view registered applicants."
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant={tab === 'browse' ? 'primary' : 'secondary'} onClick={() => setTab('browse')}>
              Browse Job Fairs
            </Button>
            <Button size="sm" variant={tab === 'participations' ? 'primary' : 'secondary'} onClick={() => setTab('participations')}>
              My Participations
            </Button>
          </div>
        }
      />

      {tab === 'participations' ? (
        <ParticipationsPanel />
      ) : isLoading ? (
        <CardSkeleton />
      ) : !fairs?.length ? (
        <EmptyState icon={MapPinned} title="No job fairs scheduled" description="You'll be notified when PESO announces a new job fair." />
      ) : (
        <motion.div variants={staggerContainer} initial="initial" animate="animate" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {fairs.map((fair) => (
            <motion.div key={fair.id} variants={staggerItem}>
              <Card className="overflow-hidden">
                {fair.banner_url && <img src={fair.banner_url} alt={fair.name} className="aspect-[16/9] w-full bg-slate-100 object-contain" />}
                <CardContent>
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-slate-900">{fair.name}</h3>
                    <StatusBadge {...fairChip(fair)} />
                  </div>
                  <p className="flex items-center gap-1.5 text-xs text-slate-500">
                    <CalendarDays className="h-3.5 w-3.5" /> {dayjs(fair.event_date).format('MMM D, YYYY h:mm A')}
                  </p>
                  <p className="flex items-center gap-1.5 text-xs text-slate-500">
                    <MapPinned className="h-3.5 w-3.5" /> {fair.venue}
                    {fair.municipality ? `, ${fair.municipality}` : ''}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {fair.registered_employers} employers · {fair.registered_jobseekers} jobseekers registered
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {['published', 'ongoing'].includes(fair.status) && (
                      <Button size="sm" onClick={() => registerMutation.mutate(fair.id)} disabled={registerMutation.isPending}>
                        Register Company Booth
                      </Button>
                    )}
                    <Button size="sm" variant="secondary" onClick={() => setBoothFair(fair)}>
                      Manage Booth
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setRegistrantsFair(fair)}>
                      <Users className="h-3.5 w-3.5" /> Applicants
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}

      {boothFair && <BoothDialog fair={boothFair} onClose={() => setBoothFair(null)} />}
      {registrantsFair && <RegistrantsDialog fair={registrantsFair} onClose={() => setRegistrantsFair(null)} />}
    </motion.div>
  )
}
