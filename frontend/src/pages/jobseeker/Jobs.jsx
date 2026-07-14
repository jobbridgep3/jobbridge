import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Briefcase, MapPin, Search } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { Badge } from '../../components/ui/Badge'
import { Card, CardContent } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Input, Select } from '../../components/ui/Input'
import { PageHeader } from '../../components/ui/PageHeader'
import { CardSkeleton } from '../../components/ui/Skeleton'
import { useSocket } from '../../hooks/useSocket'
import api from '../../lib/axios'
import { fadeIn, staggerContainer, staggerItem } from '../../lib/motion'

export default function JobseekerJobs() {
  const [filters, setFilters] = useState({ q: '', job_type: '', location: '' })
  const queryClient = useQueryClient()

  const { data: jobs, isLoading } = useQuery({
    queryKey: ['jobs', filters],
    queryFn: async () => (await api.get('/api/jobs', { params: filters })).data.data,
  })

  // Live-update the list the moment a new vacancy is published — no manual
  // refresh needed to see it appear.
  useSocket({ 'vacancy:new': () => queryClient.invalidateQueries({ queryKey: ['jobs'] }) })

  return (
    <motion.div {...fadeIn} className="space-y-6">
      <PageHeader title="Job Search" description="Browse PESO-approved active job postings ranked by your AI match score." />

      <Card>
        <CardContent className="flex flex-wrap gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-9"
              placeholder="Search by title, company, or skill"
              value={filters.q}
              onChange={(e) => setFilters({ ...filters, q: e.target.value })}
            />
          </div>
          <Input
            className="max-w-[180px]"
            placeholder="Location"
            value={filters.location}
            onChange={(e) => setFilters({ ...filters, location: e.target.value })}
          />
          <Select className="max-w-[180px]" value={filters.job_type} onChange={(e) => setFilters({ ...filters, job_type: e.target.value })}>
            <option value="">All Job Types</option>
            <option value="full-time">Full-time</option>
            <option value="part-time">Part-time</option>
            <option value="contractual">Contractual</option>
          </Select>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : !jobs?.length ? (
        <EmptyState icon={Briefcase} title="No jobs found" description="Try adjusting your search filters." />
      ) : (
        <motion.div variants={staggerContainer} initial="initial" animate="animate" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {jobs.map((job) => (
            <motion.div key={job.id} variants={staggerItem}>
              <Card hover className="h-full">
                <Link to={`/jobseeker/jobs/${job.id}`} className="block h-full p-5">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-slate-900">{job.title}</h3>
                    {job.match_score != null && <Badge variant="primary">{job.match_score}% Match</Badge>}
                  </div>
                  <p className="text-xs text-slate-500">{job.company_name}</p>
                  <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                    {job.work_location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {job.work_location}
                      </span>
                    )}
                    {job.job_type && <Badge>{job.job_type}</Badge>}
                  </div>
                  <p className="mt-3 line-clamp-2 text-xs text-slate-500">{job.description}</p>
                </Link>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}
    </motion.div>
  )
}
