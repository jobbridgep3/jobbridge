import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { BarChart3, Download, TrendingUp, Users } from 'lucide-react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { CardSkeleton } from '../../components/ui/Skeleton'
import { StatCard } from '../../components/ui/StatCard'
import api from '../../lib/axios'
import { fadeIn } from '../../lib/motion'

const COLORS = ['#1e3a8a', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#dbeafe', '#eff6ff']

export default function StaffLMI() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['staff', 'lmi', 'stats'],
    queryFn: async () => (await api.get('/api/staff/lmi/stats')).data.data,
  })

  if (isLoading || !stats) return <CardSkeleton />

  return (
    <motion.div {...fadeIn} className="space-y-6">
      <PageHeader
        title="LMI Reports"
        description="Labor Market Information dashboard and government report generation."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => window.open(`${api.defaults.baseURL}/api/staff/lmi/export/excel`, '_blank')}>
              <Download className="h-4 w-4" /> Excel
            </Button>
            <Button variant="secondary" size="sm" onClick={() => window.open(`${api.defaults.baseURL}/api/staff/lmi/export/pdf`, '_blank')}>
              <Download className="h-4 w-4" /> PDF
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Placements" value={stats.total_placements} icon={Users} tone="primary" />
        <StatCard label="Active" value={stats.active} icon={TrendingUp} tone="success" />
        <StatCard label="Success Rate" value={`${stats.success_rate}%`} icon={BarChart3} tone="warning" />
        <StatCard label="Active Vacancies" value={stats.active_vacancies} icon={Users} tone="primary" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top Industries</CardTitle>
          </CardHeader>
          <CardContent>
            {!stats.top_industries?.length ? (
              <EmptyState title="No placement data yet" />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={stats.top_industries} dataKey="count" nameKey="industry" cx="50%" cy="50%" outerRadius={90} label={(d) => d.industry}>
                    {stats.top_industries.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Program Beneficiaries</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(stats.program_beneficiaries || {}).map(([program, count]) => (
              <div key={program} className="flex items-center justify-between">
                <span className="text-sm uppercase text-slate-600">{program}</span>
                <Badge variant="primary">{count}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </motion.div>
  )
}
