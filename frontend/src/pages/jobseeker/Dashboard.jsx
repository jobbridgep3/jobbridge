import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { motion } from 'framer-motion'
import { Briefcase, CalendarCheck, ClipboardList, Search, Sparkles, UserCheck } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { CardSkeleton } from '../../components/ui/Skeleton'
import { EmptyState } from '../../components/ui/EmptyState'
import { StatCard } from '../../components/ui/StatCard'
import { CATEGORY_LABELS } from '../../config/announcementMeta'
import api from '../../lib/axios'
import { fadeIn, staggerContainer, staggerItem } from '../../lib/motion'
import { useAuthStore } from '../../store/authStore'

export default function JobseekerDashboard() {
  const user = useAuthStore((s) => s.user)

  const { data: recommended, isLoading: loadingJobs } = useQuery({
    queryKey: ['jobs', 'recommended'],
    queryFn: async () => (await api.get('/api/jobs/recommended')).data.data,
  })
  const { data: summary } = useQuery({
    queryKey: ['applications', 'summary'],
    queryFn: async () => (await api.get('/api/applications/summary')).data.data,
  })
  const { data: interviews } = useQuery({
    queryKey: ['interviews', 'upcoming'],
    queryFn: async () => (await api.get('/api/interviews/upcoming')).data.data,
  })
  const { data: announcements } = useQuery({
    queryKey: ['announcements'],
    queryFn: async () => (await api.get('/api/announcements')).data.data,
  })
  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => (await api.get('/api/profile')).data.data,
  })

  return (
    <motion.div {...fadeIn} className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Welcome back{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}!</h1>
        <p className="mt-1 text-sm text-slate-500">Here's what's happening with your job search today.</p>
      </div>

      {profile && profile.profile_completion < 100 && (
        <Card className="border-primary-200 bg-primary-50">
          <CardContent className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-primary-900">Your profile is {profile.profile_completion}% complete</p>
              <p className="text-xs text-primary-700">A complete profile means better AI job match scores.</p>
            </div>
            <Button size="sm" asChild>
              <Link to="/jobseeker/profile">Complete Profile</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <motion.div variants={staggerContainer} initial="initial" animate="animate" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: 'Applied', value: summary?.applied ?? '–', icon: ClipboardList, tone: 'primary' },
          { label: 'Under Review', value: summary?.under_review ?? '–', icon: Search, tone: 'warning' },
          { label: 'Interviews', value: summary?.interview_scheduled ?? '–', icon: CalendarCheck, tone: 'warning' },
          { label: 'Hired', value: summary?.hired ?? '–', icon: UserCheck, tone: 'success' },
        ].map((s) => (
          <motion.div key={s.label} variants={staggerItem}>
            <StatCard {...s} />
          </motion.div>
        ))}
      </motion.div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary-600" /> AI-Matched Jobs For You
            </CardTitle>
            <Button variant="link" size="sm" asChild>
              <Link to="/jobseeker/jobs">View all</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {loadingJobs ? (
              <CardSkeleton />
            ) : !recommended?.length ? (
              <EmptyState icon={Briefcase} title="No matches yet" description="Complete your profile to get AI-matched job recommendations." />
            ) : (
              recommended.map((job) => (
                <Link
                  key={job.id}
                  to={`/jobseeker/jobs/${job.id}`}
                  className="flex items-center justify-between rounded-lg border border-slate-100 p-3 hover:border-primary-200 hover:bg-primary-50/50"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900">{job.title}</p>
                    <p className="text-xs text-slate-500">{job.company_name}</p>
                  </div>
                  <Badge variant="primary">{job.match_score}% Match</Badge>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upcoming Interviews</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!interviews?.length ? (
              <EmptyState title="No interviews scheduled" />
            ) : (
              interviews.map((iv) => (
                <div key={iv.id} className="rounded-lg border border-slate-100 p-3">
                  <p className="text-sm font-medium text-slate-900">{iv.company_name}</p>
                  <p className="text-xs text-slate-500">{iv.job_title}</p>
                  <p className="mt-1 text-xs text-primary-700">{dayjs(iv.scheduled_date).format('MMM D, YYYY h:mm A')}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>PESO Announcements</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!announcements?.length ? (
            <EmptyState title="No announcements yet" />
          ) : (
            announcements.slice(0, 3).map((a) => (
              <Link
                key={a.id}
                to={`/announcements/${a.id}`}
                className="block border-b border-border-subtle pb-3 last:border-0 last:pb-0 hover:opacity-80"
              >
                <div className="mb-1 flex items-center gap-2">
                  <p className="text-sm font-medium text-text-primary">{a.title}</p>
                  <Badge variant="primary">{CATEGORY_LABELS[a.category] || a.category}</Badge>
                </div>
                <p className="line-clamp-1 text-xs text-text-muted">{(a.body || '').replace(/<[^>]*>/g, ' ')}</p>
              </Link>
            ))
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
