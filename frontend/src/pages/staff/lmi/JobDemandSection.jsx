import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Banknote, Briefcase, Building2, Factory, PieChart as PieChartIcon, TrendingUp } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { Badge } from '../../../components/ui/Badge'
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card'
import { ChartCard } from '../../../components/ui/ChartCard'
import { TableSkeleton } from '../../../components/ui/Skeleton'
import { useChartGridColors } from '../../../config/chartTheme'
import { useIsMobile } from '../../../hooks/useMediaQuery'
import api from '../../../lib/axios'
import { LMI_CHART_COLORS, toLmiParams } from './lmiFilters'

export function JobDemandSection({ filters }) {
  const { grid, axis } = useChartGridColors()
  const isMobile = useIsMobile()
  const chartHeight = isMobile ? 220 : 280
  const catAxisWidth = isMobile ? 80 : 130

  const { data, isLoading } = useQuery({
    queryKey: ['lmi', 'job-demand', filters],
    queryFn: async () => (await api.get('/api/staff/lmi/job-demand', { params: toLmiParams(filters) })).data.data,
    refetchInterval: 60_000,
  })

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-text-primary">Job Demand &amp; Vacancy Analytics</h2>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Vacancies by Occupation (Top 10)" icon={Briefcase} isLoading={isLoading} isEmpty={!data?.by_occupation?.length} emptyTitle="No vacancy data">
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart data={data?.by_occupation} layout="vertical" margin={{ left: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={grid} />
              <XAxis type="number" tick={{ fontSize: 12 }} stroke={axis} allowDecimals={false} />
              <YAxis dataKey="label" type="category" tick={{ fontSize: 11 }} stroke={axis} width={catAxisWidth} />
              <Tooltip />
              <Bar dataKey="count" name="Vacancies" fill={LMI_CHART_COLORS[0]} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Vacancies by Industry (Top 10)" icon={Factory} isLoading={isLoading} isEmpty={!data?.by_industry?.length} emptyTitle="No industry data">
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart data={data?.by_industry} layout="vertical" margin={{ left: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={grid} />
              <XAxis type="number" tick={{ fontSize: 12 }} stroke={axis} allowDecimals={false} />
              <YAxis dataKey="label" type="category" tick={{ fontSize: 11 }} stroke={axis} width={catAxisWidth} />
              <Tooltip />
              <Bar dataKey="count" name="Vacancies" fill={LMI_CHART_COLORS[1]} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Vacancies by Employer (Top 10)" icon={Building2} isLoading={isLoading} isEmpty={!data?.by_employer?.length} emptyTitle="No employer data">
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart data={data?.by_employer} layout="vertical" margin={{ left: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={grid} />
              <XAxis type="number" tick={{ fontSize: 12 }} stroke={axis} allowDecimals={false} />
              <YAxis dataKey="label" type="category" tick={{ fontSize: 11 }} stroke={axis} width={catAxisWidth} />
              <Tooltip />
              <Bar dataKey="count" name="Vacancies" fill={LMI_CHART_COLORS[2]} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Employment Type" icon={PieChartIcon} isLoading={isLoading} isEmpty={!data?.employment_type?.length} emptyTitle="No employment type data">
          <ResponsiveContainer width="100%" height={chartHeight}>
            <PieChart>
              <Pie data={data?.employment_type} dataKey="count" nameKey="label" cx="50%" cy="50%" innerRadius={55} outerRadius={90} label={(d) => (d.label || '').replace(/_/g, ' ')}>
                {data?.employment_type?.map((_, i) => (
                  <Cell key={i} fill={LMI_CHART_COLORS[i % LMI_CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Salary Range Distribution" icon={Banknote} isLoading={isLoading} isEmpty={!data?.salary_range?.length} emptyTitle="No salary data available">
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart data={data?.salary_range}>
              <CartesianGrid strokeDasharray="3 3" stroke={grid} />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke={axis} interval={0} angle={-15} textAnchor="end" height={55} />
              <YAxis tick={{ fontSize: 12 }} stroke={axis} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" name="Vacancies" fill={LMI_CHART_COLORS[5]} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Filled vs Unfilled Vacancies" icon={TrendingUp} isLoading={isLoading} isEmpty={!data?.filled_vs_unfilled || (!data.filled_vs_unfilled.filled && !data.filled_vs_unfilled.unfilled)} emptyTitle="No vacancy status data">
          <ResponsiveContainer width="100%" height={chartHeight}>
            <PieChart>
              <Pie
                data={data ? [{ label: 'Filled', count: data.filled_vs_unfilled.filled }, { label: 'Unfilled', count: data.filled_vs_unfilled.unfilled }] : []}
                dataKey="count" nameKey="label" cx="50%" cy="50%" innerRadius={55} outerRadius={90} label={(d) => d.label}
              >
                <Cell fill="#16a34a" />
                <Cell fill="#dc2626" />
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Most In-Demand Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            <RankedTable rows={data?.most_in_demand} valueLabel="Applications" isLoading={isLoading} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Applications per Vacancy</CardTitle>
          </CardHeader>
          <CardContent>
            <RankedTable rows={data?.applications_per_vacancy} valueLabel="Applications" isLoading={isLoading} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" /> Hard-to-Fill Positions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <TableSkeleton rows={3} cols={2} />
            ) : !data?.hard_to_fill?.length ? (
              <p className="py-4 text-center text-sm text-text-muted">No hard-to-fill positions for the selected filters.</p>
            ) : (
              <div className="space-y-2">
                {data.hard_to_fill.slice(0, 8).map((v, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 rounded-lg border border-border p-2 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-text-primary">{v.title}</p>
                      <p className="truncate text-xs text-text-muted">{v.employer}</p>
                    </div>
                    <Badge variant="warning">{v.applications}/{v.slots} slots</Badge>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-2 text-xs text-text-muted">Published 30+ days ago with fewer applications than open slots.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function RankedTable({ rows, valueLabel, isLoading }) {
  if (isLoading) return <TableSkeleton rows={4} cols={2} />
  if (!rows?.length) return <p className="py-4 text-center text-sm text-text-muted">No data for the selected filters.</p>
  return (
    <div className="space-y-1.5">
      {rows.slice(0, 10).map((r, i) => (
        <div key={i} className="flex items-center justify-between gap-2 text-sm">
          <span className="truncate text-text-secondary">{r.label}</span>
          <Badge>{r.count} {valueLabel}</Badge>
        </div>
      ))}
    </div>
  )
}
