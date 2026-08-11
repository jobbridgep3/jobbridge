import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { motion } from 'framer-motion'
import { Check, GraduationCap } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'

import { Button } from '../../components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Input, Label, Textarea } from '../../components/ui/Input'
import { PageHeader } from '../../components/ui/PageHeader'
import { CardSkeleton } from '../../components/ui/Skeleton'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { useSocket } from '../../hooks/useSocket'
import api from '../../lib/axios'
import { fadeIn } from '../../lib/motion'
import { cn } from '../../lib/utils'

const STEPS = [
  { key: 'pending', label: 'Pending' },
  { key: 'pooled', label: 'Pooled' },
  { key: 'submitted_to_tesda', label: 'Submitted to TESDA' },
  { key: 'for_tesda_response', label: 'Awaiting Response' },
  { key: 'completed', label: 'Completed' },
]

function ReferralStepper({ status }) {
  if (status === 'declined') return null
  const currentIndex = Math.max(0, STEPS.findIndex((s) => s.key === status))
  return (
    <ol className="mt-3 flex items-center gap-1.5">
      {STEPS.map((step, i) => (
        <li key={step.key} className="flex flex-1 items-center gap-1.5">
          <div className="flex flex-col items-center gap-1">
            <span
              className={cn(
                'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold',
                i <= currentIndex ? 'bg-primary-800 text-white' : 'bg-surface-hover text-text-muted'
              )}
            >
              {i < currentIndex ? <Check className="h-3 w-3" /> : i + 1}
            </span>
            <span className={cn('hidden text-center text-[10px] sm:block', i <= currentIndex ? 'text-text-primary' : 'text-text-muted')}>
              {step.label}
            </span>
          </div>
          {i < STEPS.length - 1 && <div className={cn('h-0.5 flex-1', i < currentIndex ? 'bg-primary-800' : 'bg-surface-hover')} />}
        </li>
      ))}
    </ol>
  )
}

export default function JobseekerTrainingReferral() {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({ program_interest: '', notes: '' })

  const { data: applications, isLoading } = useQuery({
    queryKey: ['training_referral', 'my'],
    queryFn: async () => (await api.get('/api/training-referral/my')).data.data,
  })

  useSocket({ 'training_referral:status_change': () => queryClient.invalidateQueries({ queryKey: ['training_referral', 'my'] }) })

  const applyMutation = useMutation({
    mutationFn: () => api.post('/api/training-referral/apply', form),
    onSuccess: () => {
      toast.success('Application submitted.')
      queryClient.invalidateQueries({ queryKey: ['training_referral', 'my'] })
      setForm({ program_interest: '', notes: '' })
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not submit application.'),
  })

  const withdrawMutation = useMutation({
    mutationFn: (id) => api.put(`/api/training-referral/${id}/withdraw`),
    onSuccess: () => {
      toast.success('Application withdrawn.')
      queryClient.invalidateQueries({ queryKey: ['training_referral', 'my'] })
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not withdraw application.'),
  })

  return (
    <motion.div {...fadeIn} className="space-y-6">
      <PageHeader
        title="ManPower Skills Management"
        description="Apply for referral into a TESDA-linked Manpower Skills Training Program. PESO Staff pools applicants into batches before submitting a proposal to TESDA."
      />

      <Card>
        <CardHeader>
          <CardTitle>New Application</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label>Program / Skill Interest</Label>
            <Input
              placeholder="e.g. Welding NC II"
              value={form.program_interest}
              onChange={(e) => setForm({ ...form, program_interest: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Preferred Schedule / Supporting Notes (optional)</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <Button
              onClick={() => applyMutation.mutate()}
              disabled={applyMutation.isPending || !form.program_interest.trim()}
            >
              {applyMutation.isPending ? 'Submitting…' : 'Submit Application'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>My Application</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <CardSkeleton />
          ) : !applications?.length ? (
            <EmptyState icon={GraduationCap} title="No applications yet" description="Submit an application above to get started." />
          ) : (
            applications.map((app) => (
              <div key={app.id} className="rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-text-primary">{app.program_interest}</p>
                    <p className="text-xs text-text-muted">Applied {dayjs(app.application_date || app.created_at).format('MMM D, YYYY')}</p>
                  </div>
                  <StatusBadge status={app.status} />
                </div>

                {app.batch_name && <p className="mt-2 text-sm text-text-secondary">Batch: {app.batch_name}</p>}
                {app.remarks && app.status === 'declined' && <p className="mt-2 text-sm text-red-600">Reason: {app.remarks}</p>}

                <ReferralStepper status={app.status} />

                {['pending', 'pooled'].includes(app.status) && (
                  <div className="mt-3 flex justify-end">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => withdrawMutation.mutate(app.id)}
                      disabled={withdrawMutation.isPending}
                    >
                      Withdraw Application
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
