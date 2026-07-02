import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Activity, ShieldCheck, UserCog, Users } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { StatCard } from '../../components/ui/StatCard'
import api from '../../lib/axios'
import { fadeIn, staggerContainer, staggerItem } from '../../lib/motion'

export default function AdminDashboard() {
  const { data: stats } = useQuery({
    queryKey: ['staff', 'dashboard-stats'],
    queryFn: async () => (await api.get('/api/staff/dashboard-stats')).data.data,
  })
  const { data: audit } = useQuery({
    queryKey: ['admin', 'audit', 'recent'],
    queryFn: async () => (await api.get('/api/admin/audit')).data.data,
  })
  const { data: staffList } = useQuery({
    queryKey: ['admin', 'staff'],
    queryFn: async () => (await api.get('/api/admin/staff')).data.data,
  })

  return (
    <motion.div {...fadeIn} className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Admin Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">Full system control and oversight.</p>
      </div>

      <motion.div variants={staggerContainer} initial="initial" animate="animate" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: 'Jobseekers', value: stats?.total_jobseekers ?? '–', icon: Users, tone: 'primary' },
          { label: 'Employers', value: stats?.total_employers ?? '–', icon: Users, tone: 'primary' },
          { label: 'PESO Staff', value: staffList?.length ?? '–', icon: UserCog, tone: 'success' },
          { label: 'Active Vacancies', value: stats?.active_vacancies ?? '–', icon: ShieldCheck, tone: 'warning' },
        ].map((s) => (
          <motion.div key={s.label} variants={staggerItem}>
            <StatCard {...s} />
          </motion.div>
        ))}
      </motion.div>

      <div className="flex gap-3">
        <Link to="/admin/staff/create" className="rounded-lg bg-primary-800 px-4 py-2 text-sm font-medium text-white hover:bg-primary-900">
          + Create Staff Account
        </Link>
        <Link to="/admin/audit" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          View Audit Trail
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary-600" /> Recent Audit Trail
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {!audit?.length ? (
            <EmptyState title="No audit activity yet" />
          ) : (
            audit.slice(0, 10).map((a) => (
              <div key={a.id} className="flex items-center justify-between border-b border-slate-100 py-2 text-sm last:border-0">
                <span className="text-slate-700">
                  <span className="font-medium">{a.user_email}</span> — {a.action} on {a.module}
                </span>
                <span className="text-xs text-slate-400">{new Date(a.created_at).toLocaleString()}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
