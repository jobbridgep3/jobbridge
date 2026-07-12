import { useQuery } from '@tanstack/react-query'
import { CalendarClock, Percent, TrendingUp, UserCheck } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card'
import api from '../../../lib/axios'

export function CompanyInsights() {
  const { data } = useQuery({
    queryKey: ['employer', 'dashboard', 'insights'],
    queryFn: async () => (await api.get('/api/employer/dashboard/insights')).data.data,
  })

  const items = [
    { label: 'Employees Hired', value: data?.employees_hired ?? '–', icon: UserCheck },
    { label: 'Average Hiring Time', value: data?.avg_hiring_time_days != null ? `${data.avg_hiring_time_days} days` : '–', icon: CalendarClock },
    { label: 'Acceptance Rate', value: data ? `${data.acceptance_rate}%` : '–', icon: Percent },
    { label: 'Vacancy Fill Rate', value: data ? `${data.vacancy_fill_rate}%` : '–', icon: TrendingUp },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Company Insights</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {items.map(({ label, value, icon: Icon }) => (
          <div key={label} className="flex flex-col items-start gap-1 rounded-lg border border-slate-100 p-3">
            <Icon className="h-4 w-4 text-primary-600" />
            <span className="text-lg font-semibold text-slate-900">{value}</span>
            <span className="text-xs text-slate-500">{label}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
