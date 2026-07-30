import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ArrowLeft, Briefcase } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { VacancyDisplay } from '../../components/vacancy/VacancyDisplay'
import { Button } from '../../components/ui/Button'
import { CardSkeleton } from '../../components/ui/Skeleton'
import { EmptyState } from '../../components/ui/EmptyState'
import { useSocket } from '../../hooks/useSocket'
import api from '../../lib/axios'
import { fadeIn } from '../../lib/motion'
import { resolveJobseekerCta } from '../../lib/publicCta'
import { VACANCY_FULL_MESSAGE } from '../../lib/vacancyStateMachine'
import { useAuthStore } from '../../store/authStore'

export default function PublicJobDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const token = useAuthStore((s) => s.token)
  const role = useAuthStore((s) => s.user?.role)

  const { data: job, isLoading, error } = useQuery({
    queryKey: ['public', 'jobs', id],
    queryFn: async () => (await api.get(`/api/jobs/${id}`)).data.data,
  })

  // Live-refresh capacity the moment a slot is filled or freed elsewhere.
  useSocket(
    {
      'public:homepage_update': (payload) => {
        if (payload?.sections?.includes('jobs')) queryClient.invalidateQueries({ queryKey: ['public', 'jobs', id] })
      },
    },
    { allowAnonymous: true }
  )

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <CardSkeleton />
      </div>
    )
  }

  if (error || !job) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <EmptyState icon={Briefcase} title="Job not found" description="This vacancy may have been closed or removed." />
      </div>
    )
  }

  const action = resolveJobseekerCta({ token, role, targetPath: `/jobseeker/jobs/${id}` })

  return (
    <motion.div {...fadeIn} className="mx-auto max-w-3xl space-y-4 p-6">
      <Link to="/jobs" className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-primary-700">
        <ArrowLeft className="h-4 w-4" /> Back to Find Jobs
      </Link>

      <VacancyDisplay vacancy={job} slotsRemaining={job.slots_remaining} />

      {action && (
        <div className="flex justify-end">
          {job.already_hired_at_company ? (
            <Button size="lg" disabled>Already Employed Here</Button>
          ) : job.is_full ? (
            <p className="text-sm text-text-secondary">{VACANCY_FULL_MESSAGE}</p>
          ) : (
            <Button size="lg" onClick={() => navigate(action.to, action.state ? { state: action.state } : undefined)}>
              Apply Now
            </Button>
          )}
        </div>
      )}
    </motion.div>
  )
}
