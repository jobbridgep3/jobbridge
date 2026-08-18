import { useQuery } from '@tanstack/react-query'
import { Award, Briefcase, Cake, GraduationCap, MapPinned, Users2 } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card'
import { ChartCard } from '../../../components/ui/ChartCard'
import { TableSkeleton } from '../../../components/ui/Skeleton'
import { useChartGridColors } from '../../../config/chartTheme'
import { useIsMobile } from '../../../hooks/useMediaQuery'
import api from '../../../lib/axios'
import { LMI_CHART_COLORS, toLmiParams } from './lmiFilters'

export function JobseekerProfileSection({ filters }) {
  const { grid, axis } = useChartGridColors()
  const isMobile = useIsMobile()
  const chartHeight = isMobile ? 220 : 280
  const catAxisWidth = isMobile ? 80 : 130

  const { data, isLoading } = useQuery({
    queryKey: ['lmi', 'jobseeker-profile', filters],
    queryFn: async () => (await api.get('/api/staff/lmi/jobseeker-profile', { params: toLmiParams(filters) })).data.data,
    refetchInterval: 60_000,
  })

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-text-primary">Jobseeker Labor Profile</h2>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <Users2 className="h-5 w-5 text-primary-600" />
            <div>
              <p className="text-xs text-text-muted">Profiled</p>
              <p className="text-lg font-semibold text-text-primary">{data?.total ?? '—'}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <Briefcase className="h-5 w-5 text-primary-600" />
            <div>
              <p className="text-xs text-text-muted">Avg. Work Experience Entries</p>
              <p className="text-lg font-semibold text-text-primary">{data?.work_experience_avg ?? '—'}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <Award className="h-5 w-5 text-primary-600" />
            <div>
              <p className="text-xs text-text-muted">Certifications Tracked</p>
              <p className="text-lg font-semibold text-text-primary">{data?.certifications?.length ?? '—'}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <GraduationCap className="h-5 w-5 text-primary-600" />
            <div>
              <p className="text-xs text-text-muted">Attainment Levels Represented</p>
              <p className="text-lg font-semibold text-text-primary">{data?.educational_attainment?.length ?? '—'}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Age Groups" icon={Cake} isLoading={isLoading} isEmpty={!data?.age_groups?.some((d) => d.count)} emptyTitle="No age data for the selected filters">
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart data={data?.age_groups}>
              <CartesianGrid strokeDasharray="3 3" stroke={grid} />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke={axis} />
              <YAxis tick={{ fontSize: 12 }} stroke={axis} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" name="Jobseekers" fill={LMI_CHART_COLORS[1]} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Gender" icon={Users2} isLoading={isLoading} isEmpty={!data?.gender?.length} emptyTitle="No gender data for the selected filters">
          <ResponsiveContainer width="100%" height={chartHeight}>
            <PieChart>
              <Pie data={data?.gender} dataKey="count" nameKey="label" cx="50%" cy="50%" innerRadius={55} outerRadius={90} label={(d) => d.label}>
                {data?.gender?.map((_, i) => (
                  <Cell key={i} fill={LMI_CHART_COLORS[i % LMI_CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Employment Status" icon={Briefcase} isLoading={isLoading} isEmpty={!data?.employment_status?.length} emptyTitle="No employment status data">
          <ResponsiveContainer width="100%" height={chartHeight}>
            <PieChart>
              <Pie data={data?.employment_status} dataKey="count" nameKey="label" cx="50%" cy="50%" innerRadius={55} outerRadius={90} label={(d) => d.label}>
                {data?.employment_status?.map((_, i) => (
                  <Cell key={i} fill={LMI_CHART_COLORS[i % LMI_CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Educational Attainment" icon={GraduationCap} isLoading={isLoading} isEmpty={!data?.educational_attainment?.some((d) => d.count)} emptyTitle="No education data">
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart data={data?.educational_attainment}>
              <CartesianGrid strokeDasharray="3 3" stroke={grid} />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke={axis} interval={0} angle={-15} textAnchor="end" height={50} />
              <YAxis tick={{ fontSize: 12 }} stroke={axis} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" name="Jobseekers" fill={LMI_CHART_COLORS[2]} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Barangay Distribution (Top 10)" icon={MapPinned} isLoading={isLoading} isEmpty={!data?.barangay?.length} emptyTitle="No barangay data">
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart data={data?.barangay?.slice(0, 10)} layout="vertical" margin={{ left: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={grid} />
              <XAxis type="number" tick={{ fontSize: 12 }} stroke={axis} allowDecimals={false} />
              <YAxis dataKey="label" type="category" tick={{ fontSize: 11 }} stroke={axis} width={catAxisWidth} />
              <Tooltip />
              <Bar dataKey="count" name="Jobseekers" fill={LMI_CHART_COLORS[3]} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Top Skills (Technical + Soft)" icon={Award} isLoading={isLoading} isEmpty={!data?.skills?.length} emptyTitle="No skills data">
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart data={data?.skills} layout="vertical" margin={{ left: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={grid} />
              <XAxis type="number" tick={{ fontSize: 12 }} stroke={axis} allowDecimals={false} />
              <YAxis dataKey="label" type="category" tick={{ fontSize: 11 }} stroke={axis} width={catAxisWidth} />
              <Tooltip />
              <Bar dataKey="count" name="Jobseekers" fill={LMI_CHART_COLORS[4]} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Preferred Occupation</CardTitle>
          </CardHeader>
          <CardContent>
            <MiniTable rows={data?.preferred_occupation} label="Occupation" isLoading={isLoading} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Preferred Industry</CardTitle>
          </CardHeader>
          <CardContent>
            <MiniTable rows={data?.preferred_industry} label="Industry" isLoading={isLoading} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function MiniTable({ rows, label, isLoading }) {
  if (isLoading) return <TableSkeleton rows={4} cols={2} />
  if (!rows?.length) return <p className="py-4 text-center text-sm text-text-muted">No data for the selected filters.</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase text-text-muted">
            <th className="py-1.5">{label}</th>
            <th className="py-1.5 text-right">Jobseekers</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 10).map((r) => (
            <tr key={r.label} className="border-b border-border-subtle">
              <td className="py-1.5 text-text-secondary">{r.label}</td>
              <td className="py-1.5 text-right font-medium text-text-primary">{r.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
