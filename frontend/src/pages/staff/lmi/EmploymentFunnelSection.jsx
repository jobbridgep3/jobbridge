import { useQuery } from '@tanstack/react-query'
import { Clock, GitBranch } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card'
import { ChartCard } from '../../../components/ui/ChartCard'
import { Skeleton } from '../../../components/ui/Skeleton'
import { StatCard } from '../../../components/ui/StatCard'
import { useChartGridColors } from '../../../config/chartTheme'
import { useIsMobile } from '../../../hooks/useMediaQuery'
import api from '../../../lib/axios'
import { toLmiParams } from './lmiFilters'

// Matches --color-status-* conventions used elsewhere (blue -> amber -> green progression).
const STAGE_COLORS = ['#64748b', '#2563eb', '#7c3aed', '#d97706', '#16a34a', '#0891b2']

export function EmploymentFunnelSection({ filters }) {
  const { grid, axis } = useChartGridColors()
  const isMobile = useIsMobile()
  const chartHeight = isMobile ? 240 : 300

  const { data, isLoading } = useQuery({
    queryKey: ['lmi', 'employment-funnel', filters],
    queryFn: async () => (await api.get('/api/staff/lmi/employment-funnel', { params: toLmiParams(filters) })).data.data,
    refetchInterval: 60_000,
  })

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-text-primary">Employment &amp; Placement Analytics</h2>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Referral Rate" value={data ? `${data.referral_rate}%` : '—'} tone="primary" />
        <StatCard label="Interview Rate" value={data ? `${data.interview_rate}%` : '—'} tone="warning" />
        <StatCard label="Placement Rate" value={data ? `${data.placement_rate}%` : '—'} tone="success" />
        <StatCard label="Employment Rate" value={data ? `${data.employment_rate}%` : '—'} tone="success" />
      </div>

      <ChartCard title="Employment Pipeline" icon={GitBranch} isLoading={isLoading} isEmpty={!data?.funnel?.some((d) => d.count)} emptyTitle="No pipeline data for the selected filters">
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart data={data?.funnel} layout="vertical" margin={{ left: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={grid} />
            <XAxis type="number" tick={{ fontSize: 12 }} stroke={axis} allowDecimals={false} />
            <YAxis dataKey="stage" type="category" tick={{ fontSize: 12 }} stroke={axis} width={110} />
            <Tooltip />
            <Bar dataKey="count" name="Jobseekers" radius={[0, 4, 4, 0]}>
              {data?.funnel?.map((_, i) => (
                <Cell key={i} fill={STAGE_COLORS[i % STAGE_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary-600" /> Time-to-Placement
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-4 w-2/3" />
          ) : data?.time_to_placement_days == null ? (
            <p className="text-sm text-text-muted">Insufficient data to calculate an average.</p>
          ) : (
            <p className="text-sm text-text-secondary">
              On average, <span className="font-semibold text-text-primary">{data.time_to_placement_days} days</span> from
              application to placement, based on application-linked hires only (N={data.time_to_placement_n}). Staff-entered
              walk-in hires ({data?.walk_in_hires ?? 0}) have no application date to measure from and are excluded from this
              average.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
