import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'

import { Badge } from '../../components/ui/Badge'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import api from '../../lib/axios'
import { fadeIn } from '../../lib/motion'
import { AnalyticsCharts } from '../admin/dashboard/AnalyticsCharts'
import { AnnouncementsWidget } from '../admin/dashboard/AnnouncementsWidget'
import { DashboardExportDialog } from '../admin/dashboard/DashboardExportDialog'
import { SummaryCards } from '../admin/dashboard/SummaryCards'

export default function StaffDashboard() {
  const { data: pending } = useQuery({
    queryKey: ['staff', 'pending-approvals'],
    queryFn: async () => (await api.get('/api/staff/pending-approvals')).data.data,
  })
  const { data: activity } = useQuery({
    queryKey: ['staff', 'activity-feed'],
    queryFn: async () => (await api.get('/api/staff/activity-feed')).data.data,
  })

  return (
    <motion.div {...fadeIn} className="space-y-6">
      <PageHeader
        title="PESO Staff Command Center"
        description="Full operational overview of JobBridge."
        actions={<DashboardExportDialog apiBase="/api/staff" />}
      />

      <SummaryCards apiBase="/api/staff" />
      <AnalyticsCharts apiBase="/api/staff" />

      <Card>
        <CardHeader>
          <CardTitle>Pending Approvals</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Link to="/staff/vacancies?status=pending">
            <Badge variant="warning" className="px-3 py-1.5">{pending?.vacancies_pending ?? 0} Vacancies Pending</Badge>
          </Link>
          <Link to="/staff/employers">
            <Badge variant="warning" className="px-3 py-1.5">{pending?.employers_pending ?? 0} Employer Verifications</Badge>
          </Link>
          <Link to="/staff/spes">
            <Badge variant="warning" className="px-3 py-1.5">{pending?.spes_pending ?? 0} SPES Applications</Badge>
          </Link>
          <Link to="/staff/dilp">
            <Badge variant="warning" className="px-3 py-1.5">{pending?.dilp_pending ?? 0} DILP Applications</Badge>
          </Link>
          <Link to="/staff/owwa">
            <Badge variant="warning" className="px-3 py-1.5">{pending?.owwa_pending ?? 0} OWWA Applications</Badge>
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {!activity?.length ? (
            <EmptyState title="No recent activity" />
          ) : (
            activity.slice(0, 10).map((a) => (
              <div key={a.id} className="flex items-center justify-between border-b border-slate-100 py-2 text-sm last:border-0">
                <span className="text-slate-700">
                  <span className="font-medium">{a.user_email}</span> {a.action.toLowerCase()}d {a.module}
                </span>
                <span className="text-xs text-slate-400">{new Date(a.created_at).toLocaleString()}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
      <AnnouncementsWidget />
    </motion.div>
  )
}
