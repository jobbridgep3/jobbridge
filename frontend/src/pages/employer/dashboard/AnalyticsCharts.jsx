import { useQuery } from '@tanstack/react-query'
import { BarChart3, PieChart as PieChartIcon, TrendingUp, Workflow } from 'lucide-react'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'

import { ChartCard } from '../../../components/ui/ChartCard'
import api from '../../../lib/axios'

const BLUE = '#2563eb'
const STATUS_COLORS = {
  applied: '#64748b', under_review: '#2563eb', interview_scheduled: '#d97706',
  hired: '#16a34a', rejected: '#dc2626', cancelled: '#64748b',
}
const STATUS_LABELS = {
  applied: 'Applied', under_review: 'Under Review', interview_scheduled: 'Interview Scheduled',
  hired: 'Hired', rejected: 'Rejected', cancelled: 'Cancelled',
}

export function AnalyticsCharts({ dateRange }) {
  const { data, isLoading } = useQuery({
    queryKey: ['employer', 'dashboard', 'analytics', dateRange],
    queryFn: async () => (
      await api.get('/api/employer/dashboard/analytics', {
        params: { date_from: dateRange?.date_from || undefined, date_to: dateRange?.date_to || undefined },
      })
    ).data.data,
    refetchInterval: 60_000,
  })

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <ChartCard
        title="Applications per Vacancy"
        icon={BarChart3}
        isLoading={isLoading}
        isEmpty={!data?.applications_per_vacancy?.length}
        emptyTitle="No applications yet"
      >
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data?.applications_per_vacancy} layout="vertical" margin={{ left: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis type="number" tick={{ fontSize: 12 }} stroke="#94a3b8" allowDecimals={false} />
            <YAxis dataKey="vacancy" type="category" tick={{ fontSize: 12 }} stroke="#94a3b8" width={110} />
            <Tooltip />
            <Bar dataKey="count" name="Applications" fill={BLUE} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="Applicant Status"
        icon={PieChartIcon}
        isLoading={isLoading}
        isEmpty={!data?.applicant_status?.some((d) => d.count)}
        emptyTitle="No applicants yet"
      >
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              // Only chart non-zero statuses — labeling zero-value slices crowds
              // every label on top of each other at a single point on the circle.
              data={data?.applicant_status?.filter((d) => d.count > 0)} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={90}
              label={(entry) => STATUS_LABELS[entry.status] || entry.status}
            >
              {data?.applicant_status?.filter((d) => d.count > 0).map((d) => (
                <Cell key={d.status} fill={STATUS_COLORS[d.status] || BLUE} />
              ))}
            </Pie>
            <Tooltip formatter={(value, _name, entry) => [value, STATUS_LABELS[entry.payload.status] || entry.payload.status]} />
            <Legend formatter={(value) => STATUS_LABELS[value] || value} />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="Monthly Applications"
        icon={TrendingUp}
        isLoading={isLoading}
        isEmpty={!data?.monthly_applications?.some((d) => d.count)}
        emptyTitle="No applications in this period"
      >
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={data?.monthly_applications}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#94a3b8" />
            <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" allowDecimals={false} />
            <Tooltip />
            <Area type="monotone" dataKey="count" name="Applications" stroke={BLUE} fill={BLUE} fillOpacity={0.15} strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="Hiring Funnel"
        icon={Workflow}
        isLoading={isLoading}
        isEmpty={!data?.hiring_funnel?.some((d) => d.count)}
        emptyTitle="No applications yet"
      >
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data?.hiring_funnel}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="stage" tick={{ fontSize: 12 }} stroke="#94a3b8" />
            <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="count" name="Count" fill={BLUE} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  )
}
