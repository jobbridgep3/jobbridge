import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { motion } from 'framer-motion'
import { ArrowLeft, CalendarDays, MapPin, Shirt } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'

import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { Dialog, DialogContent } from '../../components/ui/Dialog'
import { Input, Label } from '../../components/ui/Input'
import { PageHeader } from '../../components/ui/PageHeader'
import { CardSkeleton } from '../../components/ui/Skeleton'
import api from '../../lib/axios'
import { fadeIn } from '../../lib/motion'

function DressCodeDisplay({ dressCode }) {
  if (!dressCode || (!dressCode.top?.length && !dressCode.bottom?.length && !dressCode.footwear?.length)) return null
  return (
    <div className="mt-2 space-y-1 text-sm text-text-secondary">
      {['top', 'bottom', 'footwear'].map((section) =>
        dressCode[section]?.length ? (
          <p key={section}>
            <span className="font-medium capitalize">{section}:</span> {dressCode[section].join(', ')}
          </p>
        ) : null
      )}
    </div>
  )
}

function ScheduleCard({ label, when, venue, dressCode }) {
  return (
    <Card>
      <CardHeader><CardTitle>{label}</CardTitle></CardHeader>
      <CardContent>
        {when ? (
          <>
            <p className="flex items-center gap-1.5 text-sm text-text-secondary">
              <CalendarDays className="h-4 w-4" /> {dayjs(when).format('MMMM D, YYYY [at] h:mm A')}
            </p>
            {venue && (
              <p className="mt-1 flex items-center gap-1.5 text-sm text-text-secondary">
                <MapPin className="h-4 w-4" /> {venue}
              </p>
            )}
            {dressCode && (
              <p className="mt-2 flex items-start gap-1.5 text-sm text-text-secondary">
                <Shirt className="mt-0.5 h-4 w-4 shrink-0" />
                <DressCodeDisplay dressCode={dressCode} />
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-text-muted">To be announced.</p>
        )}
      </CardContent>
    </Card>
  )
}

export default function JobseekerSPESBatchDetail() {
  const { batchId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [registerOpen, setRegisterOpen] = useState(false)
  const [form, setForm] = useState({ school_name: '', year_level: '', family_income: '', gwa: '' })

  const { data: batch, isLoading } = useQuery({
    queryKey: ['spes', 'batches', batchId],
    queryFn: async () => (await api.get(`/api/spes/batches/${batchId}`)).data.data,
  })
  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => (await api.get('/api/profile')).data.data,
  })

  const register = useMutation({
    mutationFn: () =>
      api.post(`/api/spes/batches/${batchId}/register`, {
        school_name: form.school_name, year_level: form.year_level,
        family_income: Number(form.family_income), gwa: Number(form.gwa),
      }),
    onSuccess: (res) => {
      toast.success(res.data.message || 'Registered!')
      queryClient.invalidateQueries({ queryKey: ['spes', 'my'] })
      setRegisterOpen(false)
      navigate('/jobseeker/spes?tab=applications')
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not submit your registration.'),
  })

  if (isLoading || !batch) return <CardSkeleton />

  const deadlinePassed = dayjs().isAfter(dayjs(batch.registration_deadline))
  const canRegister = batch.status === 'open' && !batch.is_full && !deadlinePassed

  const age = profile?.age
  const ageInvalid = age != null && (age < 15 || age > 30)
  // GWA scale: 1.00 is the HIGHEST/best grade — qualifying means a GWA numerically
  // at or below the batch's threshold, so anything ABOVE it fails to qualify.
  const gwaInvalid = form.gwa && batch.min_gwa != null && Number(form.gwa) > batch.min_gwa
  const incomeInvalid = form.family_income && batch.max_family_income != null && Number(form.family_income) > batch.max_family_income

  return (
    <motion.div {...fadeIn} className="space-y-4">
      <Link to="/jobseeker/spes" className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-text-primary">
        <ArrowLeft className="h-4 w-4" /> Back to SPES Batches
      </Link>

      <PageHeader
        title={batch.batch_name}
        description={batch.description}
        actions={
          canRegister ? (
            <Button onClick={() => setRegisterOpen(true)}>Register</Button>
          ) : (
            <Badge variant={batch.is_full ? 'danger' : 'default'}>
              {batch.status !== 'open' ? 'Closed' : batch.is_full ? 'Full' : deadlinePassed ? 'Deadline Passed' : 'Not Open'}
            </Badge>
          )
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent>
            <p className="text-xs font-medium uppercase text-text-muted">Registration Deadline</p>
            <p className="text-lg font-semibold text-text-primary">{dayjs(batch.registration_deadline).format('MMM D, YYYY')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs font-medium uppercase text-text-muted">Slots Remaining</p>
            <p className="text-lg font-semibold text-text-primary">{batch.slots_remaining} of {batch.total_slots}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs font-medium uppercase text-text-muted">Eligibility</p>
            <p className="text-sm text-text-secondary">
              {batch.min_gwa != null ? `GWA ${batch.min_gwa} or better (1.00 = highest)` : 'No GWA requirement'} · {batch.max_family_income != null ? `Max. income ₱${batch.max_family_income.toLocaleString()}` : 'No income cap'}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Requirements to Bring</CardTitle></CardHeader>
        <CardContent>
          {batch.requirements?.length ? (
            <ul className="list-disc space-y-1 pl-5 text-sm text-text-secondary">
              {batch.requirements.map((r) => <li key={r}>{r}</li>)}
            </ul>
          ) : (
            <p className="text-sm text-text-muted">No additional requirements specified for this batch.</p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ScheduleCard label="Orientation / Interview" when={batch.orientation_at} venue={batch.orientation_venue} dressCode={batch.orientation_dress_code} />
        <ScheduleCard label="Examination" when={batch.exam_at} venue={batch.exam_venue} dressCode={batch.exam_dress_code} />
      </div>

      <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
        <DialogContent title="SPES Registration Form" description="Personal info is auto-filled from your profile — you can't edit it here.">
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label>Full Name</Label>
                <Input value={profile?.full_name || ''} disabled />
              </div>
              <div>
                <Label>Age</Label>
                <Input value={age ?? ''} disabled />
              </div>
            </div>
            {ageInvalid && <p className="text-xs text-red-600">You must be between 15 and 30 years old to register for SPES.</p>}
            <div>
              <Label>School Name</Label>
              <Input value={form.school_name} onChange={(e) => setForm({ ...form, school_name: e.target.value })} />
            </div>
            <div>
              <Label>Year Level</Label>
              <Input value={form.year_level} onChange={(e) => setForm({ ...form, year_level: e.target.value })} placeholder="e.g. 3rd Year College" />
            </div>
            <div>
              <Label>GWA (1.00 = highest)</Label>
              <Input type="number" step="0.01" value={form.gwa} onChange={(e) => setForm({ ...form, gwa: e.target.value })} />
              {gwaInvalid && <p className="mt-1 text-xs text-red-600">Does not meet this batch's passing requirement of {batch.min_gwa} or better.</p>}
            </div>
            <div>
              <Label>Family Income (monthly)</Label>
              <Input type="number" step="0.01" value={form.family_income} onChange={(e) => setForm({ ...form, family_income: e.target.value })} />
              {incomeInvalid && <p className="mt-1 text-xs text-red-600">Exceeds this batch's eligibility threshold of ₱{batch.max_family_income.toLocaleString()}.</p>}
            </div>
            <p className="text-xs text-text-muted">You can optionally upload supporting documents from the My Applications tab once submitted.</p>
            <div className="flex justify-end">
              <Button
                onClick={() => register.mutate()}
                disabled={
                  register.isPending || ageInvalid || gwaInvalid || incomeInvalid ||
                  !form.school_name.trim() || !form.year_level.trim() || !form.gwa || !form.family_income
                }
              >
                {register.isPending ? 'Submitting…' : 'Submit Registration'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
