import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { motion } from 'framer-motion'
import { CalendarDays, MapPinned } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { CardSkeleton } from '../../components/ui/Skeleton'
import api from '../../lib/axios'
import { fadeIn, staggerContainer, staggerItem } from '../../lib/motion'

export default function JobseekerJobFair() {
  const { data: fairs, isLoading } = useQuery({
    queryKey: ['jobfair'],
    queryFn: async () => (await api.get('/api/jobfair')).data.data,
  })

  return (
    <motion.div {...fadeIn} className="space-y-4">
      <PageHeader title="Job Fair" description="View, register for, and attend PESO-organized job fairs." />

      {isLoading ? (
        <CardSkeleton />
      ) : !fairs?.length ? (
        <EmptyState icon={MapPinned} title="No job fairs scheduled" />
      ) : (
        <motion.div variants={staggerContainer} initial="initial" animate="animate" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {fairs.map((fair) => (
            <motion.div key={fair.id} variants={staggerItem}>
              <Card hover>
                <Link to={`/jobseeker/jobfair/${fair.id}`} className="block p-5">
                  <div className="mb-2 flex items-start justify-between">
                    <h3 className="text-sm font-semibold text-slate-900">{fair.name}</h3>
                    <Badge variant={fair.status === 'upcoming' ? 'success' : 'default'} className="capitalize">
                      {fair.status}
                    </Badge>
                  </div>
                  <p className="flex items-center gap-1.5 text-xs text-slate-500">
                    <CalendarDays className="h-3.5 w-3.5" /> {dayjs(fair.event_date).format('MMM D, YYYY h:mm A')}
                  </p>
                  <p className="flex items-center gap-1.5 text-xs text-slate-500">
                    <MapPinned className="h-3.5 w-3.5" /> {fair.venue}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">{fair.registered_employers} employers • {fair.registered_jobseekers} jobseekers registered</p>
                </Link>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}
    </motion.div>
  )
}
