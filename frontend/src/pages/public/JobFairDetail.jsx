import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ArrowLeft, Building2, CalendarDays, CalendarX, MapPinned } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card, CardContent } from '../../components/ui/Card'
import { CardSkeleton } from '../../components/ui/Skeleton'
import { EmptyState } from '../../components/ui/EmptyState'
import { useSocket } from '../../hooks/useSocket'
import api from '../../lib/axios'
import { manila } from '../../lib/manilaTime'
import { fadeIn } from '../../lib/motion'
import { resolveJobseekerCta } from '../../lib/publicCta'
import { useAuthStore } from '../../store/authStore'

function DetailRow({ icon: Icon, children }) {
  return (
    <div className="flex items-start gap-2 text-sm text-text-secondary">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" />
      <span>{children}</span>
    </div>
  )
}

export default function PublicJobFairDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const token = useAuthStore((s) => s.token)
  const role = useAuthStore((s) => s.user?.role)

  const { data: fair, isLoading, error } = useQuery({
    queryKey: ['public', 'jobfairs', id],
    queryFn: async () => (await api.get(`/api/jobfair/${id}`)).data.data,
    refetchInterval: 60000,
  })

  useSocket(
    { 'public:homepage_update': (payload) => payload?.sections?.includes('jobfairs') && queryClient.invalidateQueries({ queryKey: ['public', 'jobfairs', id] }) },
    { allowAnonymous: true }
  )

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <CardSkeleton />
      </div>
    )
  }

  if (error || !fair) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <EmptyState icon={CalendarX} title="Job fair not found" description="This event may have been removed or is not open yet." />
      </div>
    )
  }

  const canRegister = fair.jobseeker_registration_open
  const action = resolveJobseekerCta({ token, role, targetPath: `/jobseeker/jobfair/${id}` })

  let closedReason = 'Registration for this job fair is closed.'
  if (fair.status === 'completed') closedReason = 'This job fair has ended.'
  else if (fair.status === 'cancelled') closedReason = 'This job fair has been cancelled.'
  else if (fair.registration_deadline_passed) closedReason = 'The registration deadline for this job fair has passed.'
  else if (fair.jobseeker_slots_full) closedReason = 'This job fair has reached its maximum number of participants.'

  return (
    <motion.div {...fadeIn} className="mx-auto max-w-3xl space-y-4 p-6">
      <Link to="/job-fair" className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-primary-700">
        <ArrowLeft className="h-4 w-4" /> Back to Job Fair
      </Link>

      <Card className="overflow-hidden">
        {fair.banner_url && <img src={fair.banner_url} alt={fair.name} className="aspect-[16/9] w-full bg-surface-secondary object-contain" />}
        <CardContent className="space-y-4">
          <div>
            <h1 className="text-xl font-semibold text-text-primary">{fair.name}</h1>
            {fair.description && (
              <div
                className="prose prose-sm dark:prose-invert mt-1 max-w-none text-text-secondary"
                dangerouslySetInnerHTML={{ __html: fair.description }}
              />
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 rounded-lg bg-surface-secondary p-4 sm:grid-cols-2">
            <DetailRow icon={CalendarDays}>
              {manila(fair.event_date).format('MMM D, YYYY h:mm A')}
              {fair.end_time ? ` – ${manila(fair.end_time).format('h:mm A')}` : ''}
            </DetailRow>
            {fair.venue && (
              <DetailRow icon={MapPinned}>
                {fair.venue}{fair.municipality ? `, ${fair.municipality}` : ''}
              </DetailRow>
            )}
            <DetailRow icon={Building2}>
              {fair.registered_employers} employers participating
            </DetailRow>
          </div>

          {fair.booths?.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-semibold text-text-primary">Participating Employers</h2>
              <div className="flex flex-wrap gap-2">
                {fair.booths.map((b) => (
                  <Badge key={b.id}>{b.company_name}</Badge>
                ))}
              </div>
            </div>
          )}

          {fair.vacancies?.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-semibold text-text-primary">Available Vacancies</h2>
              <div className="space-y-2">
                {fair.vacancies.map((v) => (
                  <Link
                    key={v.id}
                    to={`/jobs/${v.id}`}
                    className="flex items-center justify-between rounded-lg border border-border p-3 hover:border-primary-300 hover:bg-primary-50/40"
                  >
                    <div>
                      <p className="text-sm font-medium text-text-primary">{v.title}</p>
                      <p className="text-xs text-text-muted">{v.company_name}</p>
                    </div>
                    {v.job_type && <Badge className="capitalize">{v.job_type.replace(/_/g, ' ')}</Badge>}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {canRegister ? (
            action && (
              <div className="flex justify-end border-t border-border-subtle pt-4">
                <Button onClick={() => navigate(action.to, action.state ? { state: action.state } : undefined)}>
                  Register for this Job Fair
                </Button>
              </div>
            )
          ) : (
            <p className="border-t border-border-subtle pt-4 text-center text-sm text-text-muted">{closedReason}</p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
