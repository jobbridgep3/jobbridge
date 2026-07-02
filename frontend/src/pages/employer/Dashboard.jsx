import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { motion } from 'framer-motion'
import { Briefcase, CalendarCheck, ClipboardList, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Badge } from '../../components/ui/Badge'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { StatCard } from '../../components/ui/StatCard'
import api from '../../lib/axios'
import { fadeIn, staggerContainer, staggerItem } from '../../lib/motion'

export default function EmployerDashboard() {
  const { data: stats } = useQuery({
    queryKey: ['employer', 'dashboard-stats'],
    queryFn: async () => (await api.get('/api/employer/dashboard-stats')).data.data,
  })
  const { data: interviews } = useQuery({
    queryKey: ['interviews', 'upcoming'],
    queryFn: async () => (await api.get('/api/interviews/upcoming')).data.data,
  })
  const { data: announcements } = useQuery({
    queryKey: ['announcements'],
    queryFn: async () => (await api.get('/api/announcements')).data.data,
  })

  return (
    <motion.div {...fadeIn} className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Employer Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">Overview of your hiring activity.</p>
      </div>

      <motion.div variants={staggerContainer} initial="initial" animate="animate" className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {[
          { label: 'Active Vacancies', value: stats?.active_vacancies ?? '–', icon: Briefcase, tone: 'primary' },
          { label: 'Total Applicants', value: stats?.total_applicants ?? '–', icon: ClipboardList, tone: 'warning' },
          { label: 'Company Status', value: stats?.company_verification_status ?? '–', icon: ShieldCheck, tone: 'success' },
        ].map((s) => (
          <motion.div key={s.label} variants={staggerItem}>
            <StatCard {...s} value={typeof s.value === 'string' && s.value !== '–' ? <span className="capitalize">{s.value}</span> : s.value} />
          </motion.div>
        ))}
      </motion.div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Interviews</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!interviews?.length ? (
              <EmptyState icon={CalendarCheck} title="No interviews scheduled" />
            ) : (
              interviews.map((iv) => (
                <div key={iv.id} className="rounded-lg border border-slate-100 p-3">
                  <p className="text-sm font-medium text-slate-900">{iv.jobseeker_name}</p>
                  <p className="text-xs text-slate-500">{iv.job_title}</p>
                  <p className="mt-1 text-xs text-primary-700">{dayjs(iv.scheduled_date).format('MMM D, YYYY h:mm A')}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>PESO Announcements</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!announcements?.length ? (
              <EmptyState title="No announcements" />
            ) : (
              announcements.slice(0, 4).map((a) => (
                <div key={a.id} className="border-b border-slate-100 pb-2 last:border-0">
                  <p className="text-sm font-medium text-slate-900">{a.title}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-3">
        <Link to="/employer/vacancies/create">
          <Badge variant="primary" className="px-4 py-2 text-sm">+ Post a New Vacancy</Badge>
        </Link>
      </div>
    </motion.div>
  )
}
