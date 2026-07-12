import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Briefcase, CalendarCheck, CheckCircle2, ClipboardList, Lock, ShieldCheck, UserPlus, Users, XCircle } from 'lucide-react'

import { StatCard } from '../../../components/ui/StatCard'
import api from '../../../lib/axios'
import { staggerContainer, staggerItem } from '../../../lib/motion'

export function SummaryCards() {
  const { data: stats } = useQuery({
    queryKey: ['employer', 'dashboard', 'summary'],
    queryFn: async () => (await api.get('/api/employer/dashboard/summary')).data.data,
    refetchInterval: 60_000,
  })

  const cards = [
    { label: 'Active Vacancies', value: stats?.active_vacancies ?? '–', icon: Briefcase, tone: 'primary' },
    { label: 'Total Applicants', value: stats?.total_applicants ?? '–', icon: Users, tone: 'primary' },
    { label: 'New Applicants Today', value: stats?.new_applicants_today ?? '–', icon: UserPlus, tone: 'success' },
    { label: 'Scheduled Interviews', value: stats?.scheduled_interviews ?? '–', icon: CalendarCheck, tone: 'warning' },
    { label: 'Hired Applicants', value: stats?.hired_applicants ?? '–', icon: CheckCircle2, tone: 'success' },
    { label: 'Pending Vacancies', value: stats?.pending_vacancies ?? '–', icon: ClipboardList, tone: 'warning' },
    { label: 'Closed Vacancies', value: stats?.closed_vacancies ?? '–', icon: XCircle, tone: 'danger' },
    { label: 'Company Profile Completion', value: stats ? `${stats.company_profile_completion}%` : '–', icon: Lock, tone: 'primary' },
    {
      label: 'Accreditation Status',
      value: stats ? <span className="capitalize">{stats.accreditation_status.replace(/_/g, ' ')}</span> : '–',
      icon: ShieldCheck,
      tone: stats?.accreditation_status === 'accredited' ? 'success' : stats?.accreditation_status === 'rejected' ? 'danger' : 'warning',
    },
  ]

  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate" className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {cards.map((c) => (
        <motion.div key={c.label} variants={staggerItem}>
          <StatCard {...c} />
        </motion.div>
      ))}
    </motion.div>
  )
}
