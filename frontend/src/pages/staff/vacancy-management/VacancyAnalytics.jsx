import { useQuery } from '@tanstack/react-query'
import { Briefcase, Building2, MapPin, PieChart as PieChartIcon, TrendingUp, Users } from 'lucide-react'
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'

import { ChartCard } from '../../../components/ui/ChartCard'
import { StatCard } from '../../../components/ui/StatCard'
import api from '../../../lib/axios'

const BLUE = '#2563eb'
const GREEN = '#16a34a'
const SLATE = '#64748b'

export function VacancyAnalytics() {
  const { data, isLoading } = useQuery({
    queryKey: ['staff', 'vacancies', 'analytics'],
    queryFn: async () => (await api.get('/api/staff/vacancies/analytics')).data.data,
  })

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="Approval Rate" value={data ? `${data.approval_rate}%` : '–'} icon={TrendingUp} tone="success" />
        <StatCard label="Fill Rate" value={data ? `${data.fill_rate}%` : '–'} icon={Briefcase} tone="primary" />
        <StatCard
          label="Filled vs Unfilled"
          value={data ? `${data.filled_vs_unfilled.filled} / ${data.filled_vs_unfilled.unfilled}` : '–'}
          icon={PieChartIcon}
          tone="warning"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Vacancies per Month" icon={TrendingUp} isLoading={isLoading} isEmpty={!data?.vacancies_per_month?.some((d) => d.count)} emptyTitle="No data yet">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data?.vacancies_per_month}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill={BLUE} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="By Industry" icon={Briefcase} isLoading={isLoading} isEmpty={!data?.by_industry?.length} emptyTitle="No data yet">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data?.by_industry} layout="vertical" margin={{ left: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" tick={{ fontSize: 12 }} stroke="#94a3b8" allowDecimals={false} />
              <YAxis dataKey="label" type="category" tick={{ fontSize: 12 }} stroke="#94a3b8" width={110} />
              <Tooltip />
              <Bar dataKey="count" fill={GREEN} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="By Municipality" icon={MapPin} isLoading={isLoading} isEmpty={!data?.by_municipality?.length} emptyTitle="No data yet">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data?.by_municipality} layout="vertical" margin={{ left: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" tick={{ fontSize: 12 }} stroke="#94a3b8" allowDecimals={false} />
              <YAxis dataKey="label" type="category" tick={{ fontSize: 12 }} stroke="#94a3b8" width={110} />
              <Tooltip />
              <Bar dataKey="count" fill={BLUE} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="By Employment Type" icon={PieChartIcon} isLoading={isLoading} isEmpty={!data?.by_employment_type?.length} emptyTitle="No data yet">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={data?.by_employment_type} dataKey="count" nameKey="label" cx="50%" cy="50%" outerRadius={80} label={(e) => e.label}>
                {data?.by_employment_type?.map((d, i) => (
                  <Cell key={d.label} fill={[BLUE, GREEN, SLATE, '#d97706', '#dc2626'][i % 5]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Top Employers" icon={Building2} isLoading={isLoading} isEmpty={!data?.top_employers?.length} emptyTitle="No data yet">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data?.top_employers} layout="vertical" margin={{ left: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" tick={{ fontSize: 12 }} stroke="#94a3b8" allowDecimals={false} />
              <YAxis dataKey="label" type="category" tick={{ fontSize: 12 }} stroke="#94a3b8" width={110} />
              <Tooltip />
              <Bar dataKey="count" fill={GREEN} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Applications per Vacancy" icon={Users} isLoading={isLoading} isEmpty={!data?.applications_per_vacancy?.length} emptyTitle="No applications yet">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data?.applications_per_vacancy} layout="vertical" margin={{ left: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" tick={{ fontSize: 12 }} stroke="#94a3b8" allowDecimals={false} />
              <YAxis dataKey="label" type="category" tick={{ fontSize: 12 }} stroke="#94a3b8" width={110} />
              <Tooltip />
              <Bar dataKey="count" fill={BLUE} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  )
}
