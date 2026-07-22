import { useQuery } from '@tanstack/react-query'
import { Briefcase, MapPin, Search } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { Badge } from '../../components/ui/Badge'
import { Card, CardContent } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Input } from '../../components/ui/Input'
import { Skeleton } from '../../components/ui/Skeleton'
import api from '../../lib/axios'

export default function PublicJobs() {
  const [q, setQ] = useState('')

  const { data: jobs, isLoading } = useQuery({
    queryKey: ['public', 'jobs', 'list', q],
    queryFn: async () => (await api.get('/api/jobs', { params: q ? { q } : {} })).data.data,
  })

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">Find Jobs</h1>
        <p className="mt-1 text-sm text-text-muted">Browse current openings posted by PESO-accredited employers.</p>
      </div>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search job title or skills…" className="pl-9" />
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      )}

      {!isLoading && !(jobs || []).length && (
        <EmptyState icon={Briefcase} title="No jobs found" description="Try a different search term." />
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(jobs || []).map((job) => (
          <Card key={job.id} hover className="overflow-hidden">
            <Link to={`/jobs/${job.id}`} className="block">
              <CardContent>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="line-clamp-2 text-sm font-semibold text-text-primary">{job.title}</h3>
                  {job.job_type && <Badge className="shrink-0 capitalize">{job.job_type.replace(/_/g, ' ')}</Badge>}
                </div>
                <p className="mt-1 text-xs text-text-muted">{job.company_name}</p>
                {job.work_location && (
                  <p className="mt-2 flex items-center gap-1 text-xs text-text-muted">
                    <MapPin className="h-3 w-3" /> {job.work_location}
                  </p>
                )}
                {job.description && <p className="mt-2 line-clamp-2 text-xs text-text-muted">{job.description}</p>}
              </CardContent>
            </Link>
          </Card>
        ))}
      </div>
    </div>
  )
}
