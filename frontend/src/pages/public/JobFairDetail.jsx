import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { motion } from 'framer-motion'
import { ArrowLeft, Building2, CalendarDays, CalendarX, MapPinned } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card, CardContent } from '../../components/ui/Card'
import { CardSkeleton } from '../../components/ui/Skeleton'
import { EmptyState } from '../../components/ui/EmptyState'
import api from '../../lib/axios'
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
  const token = useAuthStore((s) => s.token)
  const role = useAuthStore((s) => s.user?.role)

  const { data: fair, isLoading, error } = useQuery({
    queryKey: ['public', 'jobfairs', id],
    queryFn: async () => (await api.get(`/api/jobfair/${id}`)).data.data,
  })

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

  const canRegister = ['published', 'ongoing'].includes(fair.status)
  const action = resolveJobseekerCta({ token, role, targetPath: `/jobseeker/jobfair/${id}` })

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
            {fair.description && <p className="mt-1 text-sm text-text-secondary">{fair.description}</p>}
          </div>

          <div className="grid grid-cols-1 gap-3 rounded-lg bg-surface-secondary p-4 sm:grid-cols-2">
            <DetailRow icon={CalendarDays}>
              {dayjs(fair.event_date).format('MMMM D, YYYY h:mm A')}
              {fair.end_time ? ` – ${dayjs(fair.end_time).format('h:mm A')}` : ''}
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
                  <Badge key={b.id}>{b.booth_name || b.company_name}</Badge>
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
            <p className="border-t border-border-subtle pt-4 text-center text-sm text-text-muted">
              {fair.status === 'completed' ? 'This job fair has ended.' : 'Registration for this job fair is closed.'}
            </p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
