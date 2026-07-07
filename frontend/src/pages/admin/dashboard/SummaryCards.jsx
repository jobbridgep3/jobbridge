import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Briefcase, CheckCircle2, FileText, Handshake, Percent, TrendingUp, Users } from 'lucide-react'

import { StatCard } from '../../../components/ui/StatCard'
import api from '../../../lib/axios'
import { staggerContainer, staggerItem } from '../../../lib/motion'

export function SummaryCards({ apiBase = '/api/admin' }) {
  const { data: stats } = useQuery({
    queryKey: [apiBase, 'dashboard', 'summary'],
    queryFn: async () => (await api.get(`${apiBase}/dashboard/summary`)).data.data,
    refetchInterval: 60_000,
  })

  const cards = [
    { label: 'Total Registered Job Seekers', value: stats?.total_jobseekers ?? '–', icon: Users, tone: 'primary' },
    { label: 'Active Employers', value: stats?.active_employers ?? '–', icon: Handshake, tone: 'primary' },
    { label: 'Active Job Vacancies', value: stats?.active_vacancies ?? '–', icon: Briefcase, tone: 'warning' },
    { label: 'Total Applications', value: stats?.total_applications ?? '–', icon: FileText, tone: 'primary' },
    {
      label: 'Successful Placements',
      value: (
        <>
          {stats?.successful_placements ?? '–'}
          {stats && (
            <span className="block text-xs font-normal text-slate-400">{stats.placements_this_month} this month</span>
          )}
        </>
      ),
      icon: CheckCircle2,
      tone: 'success',
    },
    {
      label: 'Employment Rate',
      value: stats ? `${stats.employment_rate}%` : '–',
      icon: TrendingUp,
      tone: 'success',
    },
    {
      label: 'Placement Success Rate',
      value: stats ? `${stats.placement_success_rate}%` : '–',
      icon: Percent,
      tone: 'success',
    },
  ]

  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
    >
      {cards.map((c) => (
        <motion.div key={c.label} variants={staggerItem}>
          <StatCard {...c} />
        </motion.div>
      ))}
    </motion.div>
  )
}
