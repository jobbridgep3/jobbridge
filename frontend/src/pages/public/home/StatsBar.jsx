import { useQuery } from '@tanstack/react-query'
import { Briefcase, Building2, CheckCircle2, Users } from 'lucide-react'

import api from '../../../lib/axios'

const STAT_CARDS = [
  { key: 'active_jobseekers', label: 'Active Jobseekers', icon: Users },
  { key: 'job_openings', label: 'Job Openings', icon: Briefcase },
  { key: 'accredited_employers', label: 'Accredited Employers', icon: Building2 },
  { key: 'successful_placements', label: 'Successful Placements', icon: CheckCircle2 },
]

export function StatsBar() {
  const { data: stats } = useQuery({
    queryKey: ['public', 'homepage-stats'],
    queryFn: async () => (await api.get('/api/public/homepage-stats')).data.data,
  })

  return (
    <div className="relative z-10 mx-auto -mt-10 max-w-6xl px-4 sm:px-6">
      <div className="grid grid-cols-2 gap-3 rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow-card)] sm:gap-6 sm:p-6 lg:grid-cols-4">
        {STAT_CARDS.map(({ key, label, icon: Icon }) => (
          <div key={key} className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-lg font-bold text-text-primary sm:text-xl">
                {stats ? `${stats[key].toLocaleString()}+` : '—'}
              </p>
              <p className="text-xs text-text-muted">{label}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
