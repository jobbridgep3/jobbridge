import { useQuery } from '@tanstack/react-query'
import { Building2, Factory } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card'
import { ChartCard } from '../../../components/ui/ChartCard'
import { TableSkeleton } from '../../../components/ui/Skeleton'
import { useChartGridColors } from '../../../config/chartTheme'
import { useIsMobile } from '../../../hooks/useMediaQuery'
import api from '../../../lib/axios'
import { LMI_CHART_COLORS, toLmiParams } from './lmiFilters'

export function EmployerIndustrySection({ filters }) {
  const { grid, axis } = useChartGridColors()
  const isMobile = useIsMobile()
  const chartHeight = isMobile ? 220 : 280
  const catAxisWidth = isMobile ? 90 : 140

  const { data, isLoading } = useQuery({
    queryKey: ['lmi', 'employer-industry', filters],
    queryFn: async () => (await api.get('/api/staff/lmi/employer-industry', { params: toLmiParams(filters) })).data.data,
    refetchInterval: 60_000,
  })

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-text-primary">Employer &amp; Industry Analytics</h2>

      <ChartCard title="Top Hiring Employers" icon={Building2} isLoading={isLoading} isEmpty={!data?.top_hiring_employers?.length} emptyTitle="No hiring data for the selected filters">
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart data={data?.top_hiring_employers} layout="vertical" margin={{ left: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={grid} />
            <XAxis type="number" tick={{ fontSize: 12 }} stroke={axis} allowDecimals={false} />
            <YAxis dataKey="label" type="category" tick={{ fontSize: 11 }} stroke={axis} width={catAxisWidth} />
            <Tooltip />
            <Bar dataKey="count" name="Hires" fill={LMI_CHART_COLORS[0]} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary-600" /> Employer Detail
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            isLoading={isLoading}
            rows={data?.by_employer}
            columns={[
              ['employer', 'Employer'], ['industry', 'Industry'], ['vacancies', 'Vacancies'], ['filled', 'Filled'],
              ['unfilled', 'Unfilled'], ['applicants', 'Applicants'], ['referrals', 'Referrals'], ['hires', 'Hired'],
            ]}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Factory className="h-4 w-4 text-primary-600" /> Industry Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            isLoading={isLoading}
            rows={data?.by_industry}
            columns={[
              ['industry', 'Industry'], ['jobseekers', 'Jobseekers (Preferred)'], ['vacancies', 'Vacancies'],
              ['applicants', 'Applicants'], ['placements', 'Placements'], ['filled', 'Filled'], ['unfilled', 'Unfilled'],
            ]}
          />
        </CardContent>
      </Card>
    </div>
  )
}

function DataTable({ rows, columns, isLoading }) {
  if (isLoading) return <TableSkeleton rows={4} cols={columns.length} />
  if (!rows?.length) return <p className="py-6 text-center text-sm text-text-muted">No data for the selected filters.</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase text-text-muted">
            {columns.map(([, label], i) => (
              <th key={label} className={`py-2 ${i > 0 ? 'text-right' : ''}`}>{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="border-b border-border-subtle">
              {columns.map(([key], i) => (
                <td key={key} className={`py-2 ${i === 0 ? 'text-text-secondary' : 'text-right text-text-primary'}`}>{row[key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
