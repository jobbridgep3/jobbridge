import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { motion } from 'framer-motion'
import { CalendarDays, MapPinned, Paperclip, Upload, Users } from 'lucide-react'
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

  const saveBooth = useMutation({
    mutationFn: () => api.put(`/api/jobfair/${fair.id}/booth`, boothForm),
    onSuccess: () => {
      toast.success('Booth updated.')
      queryClient.invalidateQueries({ queryKey: ['jobfair', fair.id] })
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not update booth.'),
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

export default function EmployerJobFair() {
  const queryClient = useQueryClient()
  const [boothFair, setBoothFair] = useState(null)
  const [registrantsFair, setRegistrantsFair] = useState(null)

  const { data: fairs, isLoading } = useQuery({
    queryKey: ['jobfair'],
    queryFn: async () => (await api.get('/api/jobfair')).data.data,
  })

  useSocket({
    'jobfair:published': () => queryClient.invalidateQueries({ queryKey: ['jobfair'] }),
    'jobfair:updated': () => queryClient.invalidateQueries({ queryKey: ['jobfair'] }),
  })

  const registerMutation = useMutation({
    mutationFn: (id) => api.post(`/api/jobfair/${id}/register-booth`),
    onSuccess: () => {
      toast.success('Booth registered — manage your booth details anytime.')
      queryClient.invalidateQueries({ queryKey: ['jobfair'] })
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not register booth.'),
  })

  return (
    <motion.div {...fadeIn} className="space-y-4">
      <PageHeader title="Job Fair" description="Register your company, manage your booth, and view registered applicants." />

      {isLoading ? (
        <CardSkeleton />
      ) : !fairs?.length ? (
        <EmptyState icon={MapPinned} title="No job fairs scheduled" description="You'll be notified when PESO announces a new job fair." />
      ) : (
        <motion.div variants={staggerContainer} initial="initial" animate="animate" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {fairs.map((fair) => (
            <motion.div key={fair.id} variants={staggerItem}>
              <Card className="overflow-hidden">
                {fair.banner_url && <img src={fair.banner_url} alt={fair.name} className="h-28 w-full object-cover" />}
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
