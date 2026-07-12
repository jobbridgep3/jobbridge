import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { motion } from 'framer-motion'
import { CalendarCheck } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { Button } from '../../components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Input, Label } from '../../components/ui/Input'
import { PageHeader } from '../../components/ui/PageHeader'
import api from '../../lib/axios'
import { fadeIn } from '../../lib/motion'
import { DashboardExportDialog } from '../admin/dashboard/DashboardExportDialog'
import { AnalyticsCharts } from './dashboard/AnalyticsCharts'
import { CompanyInsights } from './dashboard/CompanyInsights'
import { PendingActionsPanel } from './dashboard/PendingActionsPanel'
import { QuickActions } from './dashboard/QuickActions'
import { RecentActivity } from './dashboard/RecentActivity'
import { RecentApplicants } from './dashboard/RecentApplicants'
import { SummaryCards } from './dashboard/SummaryCards'

export default function EmployerDashboard() {
  const [dateRange, setDateRange] = useState({ date_from: '', date_to: '' })

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
      <PageHeader
        title="Employer Dashboard"
        description="Overview of your hiring activity."
        actions={<DashboardExportDialog apiBase="/api/employer" initialFilters={dateRange} />}
      />

      <SummaryCards />
      <QuickActions />

      <Card>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div>
            <Label>Date From</Label>
            <Input type="date" value={dateRange.date_from} onChange={(e) => setDateRange((r) => ({ ...r, date_from: e.target.value }))} />
          </div>
          <div>
            <Label>Date To</Label>
            <Input type="date" value={dateRange.date_to} onChange={(e) => setDateRange((r) => ({ ...r, date_to: e.target.value }))} />
          </div>
          <p className="text-xs text-slate-400">Filters the analytics charts below and pre-fills the export dialog above.</p>
        </CardContent>
      </Card>

      <div id="dashboard-analytics">
        <AnalyticsCharts dateRange={dateRange} />
      </div>

      <CompanyInsights />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <PendingActionsPanel />
        <RecentActivity />
      </div>

      <RecentApplicants />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Upcoming Interviews</CardTitle>
            <Button asChild variant="link" size="sm">
              <Link to="/employer/interviews">View All</Link>
            </Button>
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

        <Card id="dashboard-announcements">
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
    </motion.div>
  )
}
