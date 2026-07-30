import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import toast from 'react-hot-toast'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { Button } from '../../components/ui/Button'
import { Card, CardContent } from '../../components/ui/Card'
import { CardSkeleton } from '../../components/ui/Skeleton'
import { VacancyDisplay } from '../../components/vacancy/VacancyDisplay'
import { useSocket } from '../../hooks/useSocket'
import api from '../../lib/axios'
import { fadeIn } from '../../lib/motion'
import { VACANCY_FULL_MESSAGE } from '../../lib/vacancyStateMachine'

export default function JobseekerJobDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: job, isLoading } = useQuery({
    queryKey: ['jobs', id],
    queryFn: async () => (await api.get(`/api/jobs/${id}`)).data.data,
  })

  // Live-refresh capacity the moment a slot is filled or freed elsewhere.
  useSocket({
    'public:homepage_update': (payload) => {
      if (payload?.sections?.includes('jobs')) queryClient.invalidateQueries({ queryKey: ['jobs', id] })
    },
  })

  const applyMutation = useMutation({
    mutationFn: () => api.post('/api/applications', { vacancy_id: id }),
    onSuccess: () => {
      toast.success('Application submitted!')
      queryClient.invalidateQueries({ queryKey: ['applications'] })
      navigate('/jobseeker/applications')
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not apply.'),
  })

  if (isLoading || !job) return <CardSkeleton />

  return (
    <motion.div {...fadeIn} className="mx-auto max-w-4xl space-y-4">
      <Link to="/jobseeker/jobs" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-primary-700">
        <ArrowLeft className="h-4 w-4" /> Back to Job Search
      </Link>

      <VacancyDisplay
        vacancy={job}
        matchScore={job.match_score}
        slotsRemaining={job.slots_remaining}
        companyVerified={job.company_accredited}
      />

      <Card>
        <CardContent className="flex items-center justify-end gap-3">
          {job.already_hired_at_company ? (
            <p className="text-sm text-slate-500">You are currently employed by this company. You cannot apply to another vacancy until your employment has ended.</p>
          ) : job.is_full ? (
            <p className="text-sm text-slate-500">{VACANCY_FULL_MESSAGE}</p>
          ) : (
            <Button onClick={() => applyMutation.mutate()} disabled={applyMutation.isPending}>
              {applyMutation.isPending ? 'Submitting…' : 'Apply Now'}
            </Button>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
