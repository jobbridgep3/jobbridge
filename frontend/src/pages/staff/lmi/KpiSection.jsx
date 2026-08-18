import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Briefcase, Building2, CheckCircle2, ClipboardList, FileBarChart, Handshake, Target, TrendingUp, UserCheck, Users, UserX, Video } from 'lucide-react'

import { CardSkeleton } from '../../../components/ui/Skeleton'
import { StatCard } from '../../../components/ui/StatCard'
import api from '../../../lib/axios'
import { staggerContainer, staggerItem } from '../../../lib/motion'
import { toLmiParams } from './lmiFilters'

export function KpiSection({ filters }) {
  const { data, isLoading } = useQuery({
    queryKey: ['lmi', 'kpi', filters],
    queryFn: async () => (await api.get('/api/staff/lmi/stats', { params: toLmiParams(filters) })).data.data,
    refetchInterval: 60_000,
  })

  if (isLoading || !data) return <CardSkeleton />

  const cards = [
    { label: 'Total Registered Jobseekers', value: data.total_jobseekers, icon: Users, tone: 'primary' },
    { label: 'Active Jobseekers', value: data.active_jobseekers, icon: UserCheck, tone: 'success' },
    { label: 'Total Employers', value: data.total_employers, icon: Building2, tone: 'primary' },
    { label: 'Active Employers', value: data.active_employers, icon: CheckCircle2, tone: 'success' },
    { label: 'Total Job Vacancies', value: data.total_vacancies, icon: Briefcase, tone: 'primary' },
    { label: 'Total Applicants', value: data.total_applicants, icon: ClipboardList, tone: 'primary' },
    { label: 'Total Referrals', value: data.total_referrals, icon: Handshake, tone: 'warning' },
    { label: 'Total Interviews', value: data.total_interviews, icon: Video, tone: 'warning' },
    { label: 'Total Hired / Placed', value: data.total_hired, icon: TrendingUp, tone: 'success' },
    { label: 'Employment Rate', value: `${data.employment_rate}%`, icon: Target, tone: 'success' },
    { label: 'Placement Rate', value: `${data.placement_rate}%`, icon: FileBarChart, tone: 'success' },
    { label: 'Unfilled Vacancies', value: data.unfilled_vacancies, icon: UserX, tone: 'danger' },
  ]

  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map((c) => (
        <motion.div key={c.label} variants={staggerItem}>
          <StatCard {...c} />
        </motion.div>
      ))}
    </motion.div>
  )
}
