import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { CalendarDays, MapPinned, Plus, Users, X, XCircle } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'

import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card, CardContent } from '../../components/ui/Card'
import { Dialog, DialogContent } from '../../components/ui/Dialog'
import { EmptyState } from '../../components/ui/EmptyState'
import { Input, Label, Select } from '../../components/ui/Input'
import { PageHeader } from '../../components/ui/PageHeader'
import { CardSkeleton } from '../../components/ui/Skeleton'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { useSocket } from '../../hooks/useSocket'
import api from '../../lib/axios'
import { fadeIn, staggerContainer, staggerItem } from '../../lib/motion'
import { manila } from '../../lib/manilaTime'
import { EMPLOYMENT_TYPES } from './vacancy-sections/options'

const EMPTY_POSITION_FORM = { title: '', job_type: '', num_slots: '', description: '' }

function fairChip(fair) {
  if (fair.status === 'published' && manila(fair.event_date).isAfter(manila())) return { status: 'upcoming' }
  return { status: fair.status }
}

function RegistrationDialog({ fair, onClose }) {
  const queryClient = useQueryClient()

  const { data: detail, isLoading } = useQuery({
    queryKey: ['jobfair', fair.id],
    queryFn: async () => (await api.get(`/api/jobfair/${fair.id}`)).data.data,
  })
  const booth = detail?.my_booth

  const { data: myVacancies } = useQuery({
    queryKey: ['vacancies', 'my'],
    queryFn: async () => (await api.get('/api/vacancies/my')).data.data,
    enabled: booth?.status === 'confirmed',
  })
  const publishedVacancies = (myVacancies || []).filter((v) => v.status === 'published')

  const withdraw = useMutation({
    mutationFn: () => api.put(`/api/jobfair/${fair.id}/booth`, { action: 'cancel' }),
    onSuccess: () => {
      toast.success('Registration withdrawn.')
      queryClient.invalidateQueries({ queryKey: ['jobfair', fair.id] })
      queryClient.invalidateQueries({ queryKey: ['jobfair'] })
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not withdraw registration.'),
  })

  const toggleVacancy = useMutation({
    mutationFn: ({ vacancyId, included }) =>
      api.put(`/api/vacancies/${vacancyId}/jobfair`, { jobfair_id: included ? fair.id : null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vacancies', 'my'] })
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not update vacancy.'),
  })

  const [addingPosition, setAddingPosition] = useState(false)
  const [positionForm, setPositionForm] = useState(EMPTY_POSITION_FORM)

  const refreshPositions = () => queryClient.invalidateQueries({ queryKey: ['jobfair', fair.id] })

  const addPosition = useMutation({
    mutationFn: () =>
      api.post(`/api/jobfair/${fair.id}/positions`, {
        title: positionForm.title.trim(),
        job_type: positionForm.job_type || null,
        num_slots: positionForm.num_slots ? Number(positionForm.num_slots) : null,
        description: positionForm.description || null,
      }),
    onSuccess: () => {
      toast.success('Position added.')
      setPositionForm(EMPTY_POSITION_FORM)
      setAddingPosition(false)
      refreshPositions()
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not add position.'),
  })

  const removePosition = useMutation({
    mutationFn: (positionId) => api.delete(`/api/jobfair/${fair.id}/positions/${positionId}`),
    onSuccess: () => {
      toast.success('Position removed.')
      refreshPositions()
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not remove position.'),
  })

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent title={`My Registration — ${fair.name}`} className="max-w-lg">
        {isLoading ? (
          <CardSkeleton />
        ) : !booth ? (
          <p className="py-4 text-center text-sm text-slate-500">You haven't registered for this job fair.</p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
              <span className="text-sm text-slate-600">Registration Status</span>
              <StatusBadge status={booth.status} />
            </div>
            {booth.status === 'pending' && (
              <p className="text-xs text-slate-500">Your registration is pending PESO review.</p>
            )}
            {['rejected', 'suspended'].includes(booth.status) && booth.review_remarks && (
              <p className="text-xs text-red-600">Reason: {booth.review_remarks}</p>
            )}
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
            {booth.status === 'confirmed' && (
              <div>
                <Label>Positions Offered at This Job Fair</Label>
                <p className="mb-2 text-xs text-slate-500">
                  In-person only — separate from your regular vacancy postings. Not published online and no online applications.
                </p>
                {booth.positions?.length ? (
                  <div className="mb-2 space-y-1.5">
                    {booth.positions.map((p) => (
                      <div key={p.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                        <div>
                          <span className="font-medium text-slate-800">{p.title}</span>
                          {p.num_slots ? <span className="ml-1 text-xs text-slate-500">({p.num_slots} slot{p.num_slots > 1 ? 's' : ''})</span> : null}
                          {p.job_type && (
                            <span className="ml-1 text-xs capitalize text-slate-500">
                              · {EMPLOYMENT_TYPES.find((t) => t.value === p.job_type)?.label || p.job_type}
                            </span>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removePosition.mutate(p.id)}
                          disabled={removePosition.isPending && removePosition.variables === p.id}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mb-2 text-sm text-slate-500">No positions added yet.</p>
                )}
                {addingPosition ? (
                  <div className="space-y-2 rounded-lg border border-slate-200 p-3">
                    <Input
                      placeholder="Position title"
                      value={positionForm.title}
                      onChange={(e) => setPositionForm({ ...positionForm, title: e.target.value })}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Select value={positionForm.job_type} onChange={(e) => setPositionForm({ ...positionForm, job_type: e.target.value })}>
                        <option value="">Employment type…</option>
                        {EMPLOYMENT_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </Select>
                      <Input
                        type="number"
                        min="1"
                        placeholder="Slots (optional)"
                        value={positionForm.num_slots}
                        onChange={(e) => setPositionForm({ ...positionForm, num_slots: e.target.value })}
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setAddingPosition(false)
                          setPositionForm(EMPTY_POSITION_FORM)
                        }}
                      >
                        Cancel
                      </Button>
                      <Button size="sm" onClick={() => addPosition.mutate()} disabled={!positionForm.title.trim() || addPosition.isPending}>
                        {addPosition.isPending ? 'Adding…' : 'Add Position'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button size="sm" variant="secondary" onClick={() => setAddingPosition(true)}>
                    <Plus className="h-3.5 w-3.5" /> Add Position
                  </Button>
                )}
              </div>
            )}
            {['pending', 'confirmed'].includes(booth.status) && (
              <div className="flex justify-end border-t border-slate-100 pt-3">
                <Button size="sm" variant="danger" onClick={() => withdraw.mutate()} disabled={withdraw.isPending}>
                  <XCircle className="h-3.5 w-3.5" /> {withdraw.isPending ? 'Withdrawing…' : 'Withdraw Registration'}
                </Button>
              </div>
            )}
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
      <DialogContent title={`Registered Jobseekers — ${fair.name}`} className="max-w-2xl">
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
  const { data: participations, isLoading } = useQuery({
    queryKey: ['employer', 'jobfair', 'participations'],
    queryFn: async () => (await api.get('/api/employer/jobfair/participations')).data.data,
  })

  if (isLoading) return <CardSkeleton />
  if (!participations?.length) {
    return <EmptyState icon={MapPinned} title="No job fair participations yet" description="Register from Browse Job Fairs to get started." />
  }

  return (
    <div className="space-y-3">
      {participations.map((p) => (
        <Card key={p.booth_id}>
          <CardContent className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">{p.jobfair_name}</h3>
                <p className="flex items-center gap-1.5 text-xs text-slate-500">
                  <CalendarDays className="h-3.5 w-3.5" /> {p.event_date ? manila(p.event_date).format('MMM D, YYYY h:mm A') : '—'} · {p.venue}
                </p>
              </div>
              <StatusBadge status={p.booth_status} />
            </div>
            {p.review_remarks && <p className="text-xs text-red-600">Reason: {p.review_remarks}</p>}
            <div className="border-t border-slate-100 pt-2">
              <p className="mb-1 text-xs font-medium text-slate-600">Vacancies tagged for this job fair</p>
              {p.vacancies?.length ? (
                <div className="space-y-1">
                  {p.vacancies.map((v) => (
                    <div key={v.id} className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-slate-700">{v.title}</span>
                      {v.job_type && <Badge className="capitalize">{v.job_type.replace(/_/g, ' ')}</Badge>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400">No vacancies tagged for this job fair yet.</p>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export default function EmployerJobFair() {
  const queryClient = useQueryClient()
  const [registrationFair, setRegistrationFair] = useState(null)
  const [registrantsFair, setRegistrantsFair] = useState(null)
  const [tab, setTab] = useState('browse')

  const { data: fairs, isLoading } = useQuery({
    queryKey: ['jobfair'],
    queryFn: async () => (await api.get('/api/jobfair')).data.data,
  })

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['jobfair'] })
  useSocket({
    'jobfair:published': refresh,
    'jobfair:updated': refresh,
    'jobfair:booth_confirmed': refresh,
    'jobfair:booth_rejected': refresh,
    'jobfair:booth_suspended': refresh,
    // Fires on every registration (deadline/slot state can change from anyone's
    // action, not just this employer's), so slot-full indicators stay live.
    'public:homepage_update': (payload) => payload?.sections?.includes('jobfairs') && refresh(),
  })

  const registerMutation = useMutation({
    mutationFn: (id) => api.post(`/api/jobfair/${id}/register-booth`),
    onSuccess: (res) => {
      toast.success(res.data.message || 'Registration submitted — pending PESO review.')
      queryClient.invalidateQueries({ queryKey: ['jobfair'] })
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not register.'),
  })

  return (
    <motion.div {...fadeIn} className="space-y-4">
      <PageHeader
        title="Job Fair"
        description="Register your company as a participant and track your job fair registrations."
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
                    <CalendarDays className="h-3.5 w-3.5" /> {manila(fair.event_date).format('MMM D, YYYY h:mm A')}
                  </p>
                  <p className="flex items-center gap-1.5 text-xs text-slate-500">
                    <MapPinned className="h-3.5 w-3.5" /> {fair.venue}
                    {fair.municipality ? `, ${fair.municipality}` : ''}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {fair.registered_employers} employers · {fair.registered_jobseekers} jobseekers registered
                  </p>
                  {fair.employer_slots_full && <p className="mt-1 text-xs font-medium text-red-600">Employer slots full</p>}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {fair.my_booth && fair.my_booth.status !== 'cancelled' ? (
                      <Button size="sm" variant="secondary" disabled>
                        Registered
                      </Button>
                    ) : (
                      fair.employer_registration_open && (
                        <Button size="sm" onClick={() => registerMutation.mutate(fair.id)} disabled={registerMutation.isPending}>
                          Register as Participant
                        </Button>
                      )
                    )}
                    <Button size="sm" variant="secondary" onClick={() => setRegistrationFair(fair)}>
                      My Registration
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setRegistrantsFair(fair)}>
                      <Users className="h-3.5 w-3.5" /> Registrants
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}

      {registrationFair && <RegistrationDialog fair={registrationFair} onClose={() => setRegistrationFair(null)} />}
      {registrantsFair && <RegistrantsDialog fair={registrantsFair} onClose={() => setRegistrantsFair(null)} />}
    </motion.div>
  )
}
