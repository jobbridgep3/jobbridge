import { motion } from 'framer-motion'

import { PageHeader } from '../../components/ui/PageHeader'
import { fadeIn } from '../../lib/motion'
import { AnalyticsCharts } from './dashboard/AnalyticsCharts'
import { DashboardExportDialog } from './dashboard/DashboardExportDialog'
import { PendingActionsPanel } from './dashboard/PendingActionsPanel'
import { QuickActions } from './dashboard/QuickActions'
import { RecentActivity } from './dashboard/RecentActivity'
import { SummaryCards } from './dashboard/SummaryCards'

export default function AdminDashboard() {
  return (
    <motion.div {...fadeIn} className="space-y-6">
      <PageHeader
        title="Admin Dashboard"
        description="Full system control and oversight."
        actions={<DashboardExportDialog apiBase="/api/admin" />}
      />
      <SummaryCards />
      <QuickActions />
      <AnalyticsCharts />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <PendingActionsPanel />
        <RecentActivity />
      </div>
    </motion.div>
  )
}
