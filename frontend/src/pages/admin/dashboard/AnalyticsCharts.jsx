import { useQuery } from '@tanstack/react-query'
import { BarChart3, Briefcase, LineChart as LineChartIcon, TrendingUp, UserPlus, Wrench } from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { ChartCard } from '../../../components/ui/ChartCard'
import { useChartGridColors } from '../../../config/chartTheme'
import api from '../../../lib/axios'

const BLUE = '#2563eb'
const GREEN = '#16a34a'

// Matches the labels already used by components/ui/StatusBadge.jsx for the same statuses.
const FUNNEL_LABELS = {
  applied: 'Applied',
  under_review: 'Under Review',
  interview_scheduled: 'Interview Scheduled',
  hired: 'Hired',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
}

// Matches --color-status-* in index.css (the app's existing status-color system).
const FUNNEL_COLORS = {
  applied: '#64748b',
  under_review: '#2563eb',
  interview_scheduled: '#d97706',
  hired: '#16a34a',
  rejected: '#dc2626',
  cancelled: '#64748b',
}

export function AnalyticsCharts({ apiBase = '/api/admin' }) {
  const { grid, axis } = useChartGridColors()
  const { data, isLoading } = useQuery({
    queryKey: [apiBase, 'dashboard', 'analytics'],
    queryFn: async () => (await api.get(`${apiBase}/dashboard/analytics`)).data.data,
    refetchInterval: 60_000,
  })

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <ChartCard
        title="Monthly User Registrations"
        icon={UserPlus}
        isLoading={isLoading}
        isEmpty={!data?.monthly_registrations?.some((d) => d.jobseekers || d.employers)}
        emptyTitle="No registrations in this period"
      >
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data?.monthly_registrations}>
            <CartesianGrid strokeDasharray="3 3" stroke={grid} />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke={axis} />
            <YAxis tick={{ fontSize: 12 }} stroke={axis} allowDecimals={false} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="jobseekers" name="Jobseekers" stroke={BLUE} strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="employers" name="Employers" stroke={GREEN} strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="Monthly Job Applications"
        icon={TrendingUp}
        isLoading={isLoading}
        isEmpty={!data?.monthly_applications?.some((d) => d.count)}
        emptyTitle="No applications in this period"
      >
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={data?.monthly_applications}>
            <CartesianGrid strokeDasharray="3 3" stroke={grid} />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke={axis} />
            <YAxis tick={{ fontSize: 12 }} stroke={axis} allowDecimals={false} />
            <Tooltip />
            <Area type="monotone" dataKey="count" name="Applications" stroke={BLUE} fill={BLUE} fillOpacity={0.15} strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="Employment Trends"
        icon={LineChartIcon}
        isLoading={isLoading}
        isEmpty={!data?.employment_trends?.some((d) => d.placements)}
        emptyTitle="No placements in this period"
      >
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data?.employment_trends}>
            <CartesianGrid strokeDasharray="3 3" stroke={grid} />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke={axis} />
            <YAxis tick={{ fontSize: 12 }} stroke={axis} allowDecimals={false} />
            <Tooltip />
            <Line type="monotone" dataKey="placements" name="Placements" stroke={BLUE} strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="Hiring Analytics"
        icon={BarChart3}
        isLoading={isLoading}
        isEmpty={!data?.hiring_funnel?.some((d) => d.count)}
        emptyTitle="No applications yet"
      >
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data?.hiring_funnel?.map((d) => ({ ...d, label: FUNNEL_LABELS[d.status] || d.status }))}>
            <CartesianGrid strokeDasharray="3 3" stroke={grid} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke={axis} interval={0} angle={-20} textAnchor="end" height={60} />
            <YAxis tick={{ fontSize: 12 }} stroke={axis} allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="count" name="Applications" radius={[4, 4, 0, 0]}>
              {data?.hiring_funnel?.map((d) => (
                <Cell key={d.status} fill={FUNNEL_COLORS[d.status] || BLUE} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="Job Category Distribution"
        icon={Briefcase}
        isLoading={isLoading}
        isEmpty={!data?.job_category_distribution?.length}
        emptyTitle="No active vacancies yet"
      >
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data?.job_category_distribution} layout="vertical" margin={{ left: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={grid} />
            <XAxis type="number" tick={{ fontSize: 12 }} stroke={axis} allowDecimals={false} />
            <YAxis dataKey="category" type="category" tick={{ fontSize: 12 }} stroke={axis} width={110} />
            <Tooltip />
            <Bar dataKey="count" name="Active Vacancies" fill={BLUE} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="Most Requested Skills"
        icon={Wrench}
        isLoading={isLoading}
        isEmpty={!data?.top_skills?.length}
        emptyTitle="No skill data yet"
      >
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data?.top_skills} layout="vertical" margin={{ left: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={grid} />
            <XAxis type="number" tick={{ fontSize: 12 }} stroke={axis} allowDecimals={false} />
            <YAxis dataKey="skill" type="category" tick={{ fontSize: 12 }} stroke={axis} width={110} />
            <Tooltip />
            <Bar dataKey="count" name="Vacancies Requesting" fill={BLUE} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  )
}
