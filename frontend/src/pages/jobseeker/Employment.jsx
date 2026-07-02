import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Briefcase } from 'lucide-react'

import { Card, CardContent } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { CardSkeleton } from '../../components/ui/Skeleton'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { useSocket } from '../../hooks/useSocket'
import api from '../../lib/axios'
import { fadeIn, staggerContainer, staggerItem } from '../../lib/motion'

export default function JobseekerEmployment() {
  const queryClient = useQueryClient()
  const { data: records, isLoading } = useQuery({
    queryKey: ['employment', 'my'],
    queryFn: async () => (await api.get('/api/employment/my')).data.data,
  })

  useSocket({ 'employment:updated': () => queryClient.invalidateQueries({ queryKey: ['employment', 'my'] }) })

  return (
    <motion.div {...fadeIn} className="space-y-4">
      <PageHeader title="Employment Monitoring" description="Your current and past employment records — read-only, updated by your employer or PESO Staff." />

      {isLoading ? (
        <CardSkeleton />
      ) : !records?.length ? (
        <EmptyState icon={Briefcase} title="No employment records yet" description="Once you're hired for a job, your employment record will appear here." />
      ) : (
        <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-3">
          {records.map((r) => (
            <motion.div key={r.id} variants={staggerItem}>
              <Card>
                <CardContent className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{r.position}</p>
                    <p className="text-xs text-slate-500">{r.employer_name}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      Started {r.start_date} {r.end_date && `• Ended ${r.end_date}`}
                    </p>
                  </div>
                  <StatusBadge status={r.status} />
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}
    </motion.div>
  )
}
