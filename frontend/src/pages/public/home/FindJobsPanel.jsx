import { useQuery } from '@tanstack/react-query'
import { Briefcase, MapPin } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Card, CardContent } from '../../../components/ui/Card'
import { Skeleton } from '../../../components/ui/Skeleton'
import api from '../../../lib/axios'
import { resolveJobseekerCta } from '../../../lib/publicCta'
import { useAuthStore } from '../../../store/authStore'

export function FindJobsPanel() {
  const navigate = useNavigate()
  const token = useAuthStore((s) => s.token)
  const role = useAuthStore((s) => s.user?.role)

  const { data: jobs, isLoading } = useQuery({
    queryKey: ['public', 'jobs', 'home'],
    queryFn: async () => (await api.get('/api/jobs')).data.data,
  })

  const topThree = (jobs || []).slice(0, 3)

  const applyNow = (job) => {
    const action = resolveJobseekerCta({ token, role, targetPath: `/jobseeker/jobs/${job.id}` })
    if (action) navigate(action.to, action.state ? { state: action.state } : undefined)
  }

  return (
    <Card className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
        <div className="flex items-center gap-2">
          <Briefcase className="h-4 w-4 text-primary-600" />
          <h2 className="text-sm font-semibold text-text-primary">Find Jobs</h2>
        </div>
        <Link to="/jobs" className="text-xs font-medium text-primary-700 hover:underline dark:text-primary-400">
          View all jobs →
        </Link>
      </div>

      <CardContent className="flex-1 space-y-3 divide-y divide-border-subtle p-0">
        {isLoading && (
          <div className="space-y-3 p-5">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        )}

        {!isLoading && topThree.length === 0 && (
          <p className="p-5 text-sm text-text-muted">No job openings right now — check back soon.</p>
        )}

        {topThree.map((job) => (
          <div key={job.id} className="px-5 py-4 first:pt-4">
            <div className="flex items-start justify-between gap-2">
              <Link to={`/jobs/${job.id}`} className="min-w-0">
                <h3 className="truncate text-sm font-semibold text-text-primary hover:text-primary-700 dark:hover:text-primary-400">
                  {job.title}
                </h3>
              </Link>
              {job.job_type && (
                <Badge className="shrink-0 capitalize">{job.job_type.replace(/_/g, ' ')}</Badge>
              )}
            </div>
            <p className="mt-0.5 text-xs text-text-muted">{job.company_name}</p>
            {job.work_location && (
              <p className="mt-1 flex items-center gap-1 text-xs text-text-muted">
                <MapPin className="h-3 w-3" /> {job.work_location}
              </p>
            )}
            {job.description && <p className="mt-1 line-clamp-2 text-xs text-text-muted">{job.description}</p>}
            <div className="mt-3">
              <Button size="sm" onClick={() => applyNow(job)}>Apply Now</Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
