import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { CheckCircle2, Clock, FileText, Layers, PauseCircle, Send, UserCheck, UserX, Users, XCircle } from 'lucide-react'

import { StatCard } from '../ui/StatCard'
import { useSocket } from '../../hooks/useSocket'
import api from '../../lib/axios'
import { staggerContainer, staggerItem } from '../../lib/motion'

/** Realtime KPI dashboard for ManPower Skills Management — reused by Staff (Queue,
 * Reports) and Admin (Reports, via the shared page). Backed entirely by
 * GET /api/staff/training-referral/stats (global, unfiltered aggregate counts) and
 * live-refreshed on the same training_referral:board_update event every mutating
 * route in this module already emits — no separate realtime channel. */
export function ManpowerKpiCards() {
  const queryClient = useQueryClient()

  const { data: stats, isLoading } = useQuery({
    queryKey: ['training_referral', 'stats'],
    queryFn: async () => (await api.get('/api/staff/training-referral/stats')).data.data,
  })

  useSocket({
    'training_referral:board_update': () => queryClient.invalidateQueries({ queryKey: ['training_referral', 'stats'] }),
  })

  if (isLoading || !stats) return null

  const cards = [
    { label: 'Total Applications', value: stats.total_applications, icon: FileText, tone: 'primary' },
    { label: 'Pending', value: stats.pending, icon: Clock, tone: 'warning' },
    { label: 'Pooled (Approved)', value: stats.pooled, icon: UserCheck, tone: 'success' },
    { label: 'Submitted to TESDA', value: stats.submitted_to_tesda, icon: Send, tone: 'primary' },
    { label: 'Awaiting TESDA Response', value: stats.for_tesda_response, icon: PauseCircle, tone: 'warning' },
    { label: 'Completed Training', value: stats.completed, icon: CheckCircle2, tone: 'success' },
    { label: 'Declined', value: stats.declined, icon: XCircle, tone: 'danger' },
    { label: 'Active Batches', value: stats.active_batches, icon: Layers, tone: 'primary' },
    { label: 'Full Batches', value: stats.full_batches, icon: Users, tone: 'danger' },
    { label: 'Available Training Slots', value: stats.available_slots, icon: UserX, tone: 'success' },
  ]

  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate" className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((c) => (
        <motion.div key={c.label} variants={staggerItem}>
          <StatCard {...c} />
        </motion.div>
      ))}
    </motion.div>
  )
}
