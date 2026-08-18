import { useQuery } from '@tanstack/react-query'
import { Sparkles, Target, Wrench } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { Badge } from '../../../components/ui/Badge'
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card'
import { ChartCard } from '../../../components/ui/ChartCard'
import { TableSkeleton } from '../../../components/ui/Skeleton'
import { useChartGridColors } from '../../../config/chartTheme'
import { useIsMobile } from '../../../hooks/useMediaQuery'
import api from '../../../lib/axios'
import { LMI_CHART_COLORS, toLmiParams } from './lmiFilters'

const DEMAND_BADGE = { High: 'danger', Medium: 'warning', Balanced: 'default', Surplus: 'success' }

export function SkillsGapSection({ filters }) {
  const { grid, axis } = useChartGridColors()
  const isMobile = useIsMobile()
  const chartHeight = isMobile ? 220 : 280
  const catAxisWidth = isMobile ? 90 : 140

  const { data, isLoading } = useQuery({
    queryKey: ['lmi', 'skills-gap', filters],
    queryFn: async () => (await api.get('/api/staff/lmi/skills-gap', { params: toLmiParams(filters) })).data.data,
    refetchInterval: 60_000,
  })

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-text-primary">Skills Demand &amp; Skills Gap</h2>
      <p className="text-xs text-text-muted">
        Gap = Employer Demand (vacancies requesting a skill) − Jobseeker Supply (jobseekers listing it). Positive means a
        shortage (more demand than supply); negative means a surplus. Skill names are normalized by trimming and
        lower-casing only — near-duplicate entries (e.g. "MS Excel" vs "Excel") are not merged.
      </p>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Top Skills Among Jobseekers" icon={Sparkles} isLoading={isLoading} isEmpty={!data?.top_skills_jobseekers?.length} emptyTitle="No skills data">
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart data={data?.top_skills_jobseekers} layout="vertical" margin={{ left: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={grid} />
              <XAxis type="number" tick={{ fontSize: 12 }} stroke={axis} allowDecimals={false} />
              <YAxis dataKey="label" type="category" tick={{ fontSize: 11 }} stroke={axis} width={catAxisWidth} />
              <Tooltip />
              <Bar dataKey="count" name="Jobseekers" fill={LMI_CHART_COLORS[1]} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Top Skills Requested by Employers" icon={Wrench} isLoading={isLoading} isEmpty={!data?.top_skills_employers?.length} emptyTitle="No skills data">
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart data={data?.top_skills_employers} layout="vertical" margin={{ left: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={grid} />
              <XAxis type="number" tick={{ fontSize: 12 }} stroke={axis} allowDecimals={false} />
              <YAxis dataKey="label" type="category" tick={{ fontSize: 11 }} stroke={axis} width={catAxisWidth} />
              <Tooltip />
              <Bar dataKey="count" name="Vacancies" fill={LMI_CHART_COLORS[0]} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-4 w-4 text-primary-600" /> Skills Supply vs Demand
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton rows={5} cols={5} />
          ) : !data?.gap_table?.length ? (
            <p className="py-6 text-center text-sm text-text-muted">No skills data available for the selected filters.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase text-text-muted">
                    <th className="py-2">Skill</th>
                    <th className="py-2 text-right">Jobseekers</th>
                    <th className="py-2 text-right">Vacancies</th>
                    <th className="py-2 text-right">Gap</th>
                    <th className="py-2">Demand Level</th>
                  </tr>
                </thead>
                <tbody>
                  {data.gap_table.map((row) => (
                    <tr key={row.skill} className="border-b border-border-subtle">
                      <td className="py-2 text-text-secondary">{row.skill}</td>
                      <td className="py-2 text-right text-text-primary">{row.jobseekers}</td>
                      <td className="py-2 text-right text-text-primary">{row.vacancies}</td>
                      <td className="py-2 text-right font-medium text-text-primary">{row.gap}</td>
                      <td className="py-2">
                        <Badge variant={DEMAND_BADGE[row.demand_level] || 'default'}>{row.demand_level}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
