import { useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { motion } from 'framer-motion'
import { CalendarCheck, MapPin } from 'lucide-react'
import toast from 'react-hot-toast'

import { Button } from '../../components/ui/Button'
import { Card, CardContent } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { CardSkeleton } from '../../components/ui/Skeleton'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { useSocket } from '../../hooks/useSocket'
import api from '../../lib/axios'
import { fadeIn, staggerContainer, staggerItem } from '../../lib/motion'

export default function JobseekerInterviews() {
  const queryClient = useQueryClient()
  const { data: interviews, isLoading } = useQuery({
    queryKey: ['interviews', 'my'],
    queryFn: async () => (await api.get('/api/interviews/my')).data.data,
  })

  useSocket({ 'interview:scheduled': () => queryClient.invalidateQueries({ queryKey: ['interviews', 'my'] }) })

  const respond = async (id, action) => {
    try {
      await api.put(`/api/interviews/${id}/${action}`, action === 'decline' ? { reason: 'Schedule conflict' } : {})
      toast.success(`Interview ${action}ed.`)
      queryClient.invalidateQueries({ queryKey: ['interviews', 'my'] })
    } catch {
      toast.error('Could not update interview.')
    }
  }

  return (
    <motion.div {...fadeIn} className="space-y-4">
      <PageHeader title="Interview Schedule" description="Manage interview appointments set by employers." />

      {isLoading ? (
        <CardSkeleton />
      ) : !interviews?.length ? (
        <EmptyState icon={CalendarCheck} title="No interviews yet" />
      ) : (
        <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-3">
          {interviews.map((iv) => (
            <motion.div key={iv.id} variants={staggerItem}>
              <Card>
                <CardContent className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{iv.job_title}</p>
                    <p className="text-xs text-slate-500">{iv.company_name}</p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                      <CalendarCheck className="h-3.5 w-3.5" /> {dayjs(iv.scheduled_date).format('MMM D, YYYY h:mm A')} • {iv.mode}
                    </p>
                    {iv.location && (
                      <p className="flex items-center gap-1 text-xs text-slate-500">
                        <MapPin className="h-3.5 w-3.5" /> {iv.location}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={iv.status} />
                    {iv.status === 'pending' && (
                      <>
                        <Button size="sm" onClick={() => respond(iv.id, 'accept')}>
                          Accept
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => respond(iv.id, 'decline')}>
                          Decline
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}
    </motion.div>
  )
}
