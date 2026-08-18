import { useQuery } from '@tanstack/react-query'
import { MapPinned } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card'
import { ChartCard } from '../../../components/ui/ChartCard'
import { TableSkeleton } from '../../../components/ui/Skeleton'
import { useChartGridColors } from '../../../config/chartTheme'
import { useIsMobile } from '../../../hooks/useMediaQuery'
import api from '../../../lib/axios'
import { LMI_CHART_COLORS, toLmiParams } from './lmiFilters'

// Requirement: Barangay comparison uses a horizontal bar chart + detail table
// only — deliberately no heatmap/map visualization.
export function BarangaySection({ filters }) {
  const { grid, axis } = useChartGridColors()
  const isMobile = useIsMobile()
  const chartHeight = isMobile ? 260 : 340
  const catAxisWidth = isMobile ? 90 : 140

  const { data, isLoading } = useQuery({
    queryKey: ['lmi', 'barangay', filters],
    queryFn: async () => (await api.get('/api/staff/lmi/barangay', { params: toLmiParams(filters) })).data.data,
    refetchInterval: 60_000,
  })

  const barangays = data?.barangays || []

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-text-primary">Barangay Labor Market Analytics</h2>

      <ChartCard title="Barangay Comparison (by Registered Jobseekers)" icon={MapPinned} isLoading={isLoading} isEmpty={!barangays.length} emptyTitle="No barangay data for the selected filters">
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart data={barangays.slice(0, 15)} layout="vertical" margin={{ left: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={grid} />
            <XAxis type="number" tick={{ fontSize: 12 }} stroke={axis} allowDecimals={false} />
            <YAxis dataKey="barangay" type="category" tick={{ fontSize: 11 }} stroke={axis} width={catAxisWidth} />
            <Tooltip />
            <Bar dataKey="jobseekers" name="Jobseekers" fill={LMI_CHART_COLORS[3]} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <Card>
        <CardHeader>
          <CardTitle>Barangay Detail</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton rows={5} cols={6} />
          ) : !barangays.length ? (
            <p className="py-6 text-center text-sm text-text-muted">No labor-market data available for the selected filters.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase text-text-muted">
                    <th className="py-2">Barangay</th>
                    <th className="py-2 text-right">Jobseekers</th>
                    <th className="py-2 text-right">Employed</th>
                    <th className="py-2 text-right">Unemployed</th>
                    <th className="py-2 text-right">Vacancies</th>
                    <th className="py-2 text-right">Applicants</th>
                    <th className="py-2 text-right">Referrals</th>
                    <th className="py-2 text-right">Interviews</th>
                    <th className="py-2 text-right">Hired/Placed</th>
                    <th className="py-2 text-right">Employment Rate</th>
                    <th className="py-2 text-right">Placement Rate</th>
                    <th className="py-2">Top Skills</th>
                    <th className="py-2">Most In-Demand Jobs</th>
                  </tr>
                </thead>
                <tbody>
                  {barangays.map((b) => (
                    <tr key={b.barangay} className="border-b border-border-subtle">
                      <td className="py-2 font-medium text-text-primary">{b.barangay}</td>
                      <td className="py-2 text-right text-text-secondary">{b.jobseekers}</td>
                      <td className="py-2 text-right text-text-secondary">{b.employed}</td>
                      <td className="py-2 text-right text-text-secondary">{b.unemployed}</td>
                      <td className="py-2 text-right text-text-secondary">{b.vacancies}</td>
                      <td className="py-2 text-right text-text-secondary">{b.applicants}</td>
                      <td className="py-2 text-right text-text-secondary">{b.referrals}</td>
                      <td className="py-2 text-right text-text-secondary">{b.interviews}</td>
                      <td className="py-2 text-right text-text-secondary">{b.hired}</td>
                      <td className="py-2 text-right text-text-secondary">{b.employment_rate}%</td>
                      <td className="py-2 text-right text-text-secondary">{b.placement_rate}%</td>
                      <td className="py-2 text-text-muted">{b.top_skills}</td>
                      <td className="py-2 text-text-muted">{b.top_jobs}</td>
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
