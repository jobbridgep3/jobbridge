import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ArrowLeft, Briefcase, MapPin, Wallet } from 'lucide-react'
import toast from 'react-hot-toast'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card, CardContent } from '../../components/ui/Card'
import { CardSkeleton } from '../../components/ui/Skeleton'
import api from '../../lib/axios'
import { fadeIn } from '../../lib/motion'

export default function JobseekerJobDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: job, isLoading } = useQuery({
    queryKey: ['jobs', id],
    queryFn: async () => (await api.get(`/api/jobs/${id}`)).data.data,
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
    <motion.div {...fadeIn} className="mx-auto max-w-3xl space-y-4">
      <Link to="/jobseeker/jobs" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-primary-700">
        <ArrowLeft className="h-4 w-4" /> Back to Job Search
      </Link>

      <Card>
        <CardContent className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold text-slate-900">{job.title}</h1>
              <p className="text-sm text-slate-500">{job.company_name}</p>
            </div>
            {job.match_score != null && <Badge variant="primary" className="text-sm">{job.match_score}% Match</Badge>}
          </div>

          <div className="flex flex-wrap gap-4 text-sm text-slate-600">
            {job.work_location && (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-slate-400" /> {job.work_location}
              </span>
            )}
            {job.job_type && (
              <span className="flex items-center gap-1.5">
                <Briefcase className="h-4 w-4 text-slate-400" /> {job.job_type}
              </span>
            )}
            {(job.salary_min || job.salary_max) && (
              <span className="flex items-center gap-1.5">
                <Wallet className="h-4 w-4 text-slate-400" />
                ₱{job.salary_min?.toLocaleString()} – ₱{job.salary_max?.toLocaleString()}
              </span>
            )}
          </div>

          <div>
            <h2 className="mb-1 text-sm font-semibold text-slate-800">Job Description</h2>
            <p className="whitespace-pre-line text-sm text-slate-600">{job.description}</p>
          </div>

          {job.requirements && (
            <div>
              <h2 className="mb-1 text-sm font-semibold text-slate-800">Requirements</h2>
              <p className="whitespace-pre-line text-sm text-slate-600">{job.requirements}</p>
            </div>
          )}

          <div className="flex justify-end border-t border-slate-100 pt-4">
            <Button onClick={() => applyMutation.mutate()} disabled={applyMutation.isPending}>
              {applyMutation.isPending ? 'Submitting…' : 'Apply Now'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
