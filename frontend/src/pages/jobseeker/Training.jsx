import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { motion } from 'framer-motion'
import { Award, Download } from 'lucide-react'
import toast from 'react-hot-toast'

import { Button } from '../../components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { CardSkeleton } from '../../components/ui/Skeleton'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { useSocket } from '../../hooks/useSocket'
import api from '../../lib/axios'
import { fadeIn, staggerContainer, staggerItem } from '../../lib/motion'

export default function JobseekerTraining() {
  const queryClient = useQueryClient()

  const { data: programs, isLoading } = useQuery({
    queryKey: ['training'],
    queryFn: async () => (await api.get('/api/training')).data.data,
  })
  const { data: enrollments } = useQuery({
    queryKey: ['training', 'my-enrollments'],
    queryFn: async () => (await api.get('/api/training/my-enrollments')).data.data,
  })

  useSocket({ 'certificate:issued': () => queryClient.invalidateQueries({ queryKey: ['training', 'my-enrollments'] }) })

  const enrollMutation = useMutation({
    mutationFn: (id) => api.post(`/api/training/${id}/enroll`),
    onSuccess: () => {
      toast.success('Enrollment confirmed.')
      queryClient.invalidateQueries({ queryKey: ['training', 'my-enrollments'] })
      queryClient.invalidateQueries({ queryKey: ['training'] })
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not enroll.'),
  })

  const enrolledIds = new Set((enrollments || []).map((e) => e.program_id))

  return (
    <motion.div {...fadeIn} className="space-y-6">
      <PageHeader title="Manpower Skills Training" description="Browse and enroll in PESO skills training programs." />

      <Card>
        <CardHeader>
          <CardTitle>Available Programs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <CardSkeleton />
          ) : !programs?.length ? (
            <EmptyState icon={Award} title="No training programs available" />
          ) : (
            <motion.div variants={staggerContainer} initial="initial" animate="animate" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {programs.map((p) => (
                <motion.div key={p.id} variants={staggerItem} className="rounded-lg border border-slate-100 p-4">
                  <p className="text-sm font-semibold text-slate-900">{p.title}</p>
                  <p className="text-xs text-slate-500">{p.trainer} • {p.venue}</p>
                  <p className="text-xs text-slate-500">{dayjs(p.schedule).format('MMM D, YYYY h:mm A')}</p>
                  <p className="mt-1 text-xs text-slate-400">{p.enrolled_count}/{p.max_slots} enrolled</p>
                  <Button
                    size="sm"
                    className="mt-3"
                    disabled={enrolledIds.has(p.id) || enrollMutation.isPending}
                    onClick={() => enrollMutation.mutate(p.id)}
                  >
                    {enrolledIds.has(p.id) ? 'Enrolled' : 'Enroll'}
                  </Button>
                </motion.div>
              ))}
            </motion.div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>My Enrollments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {!enrollments?.length ? (
            <EmptyState title="No enrollments yet" />
          ) : (
            enrollments.map((e) => (
              <div key={e.id} className="flex items-center justify-between rounded-lg border border-slate-100 p-3">
                <p className="text-sm text-slate-800">{e.program_title}</p>
                <div className="flex items-center gap-2">
                  <StatusBadge status={e.status} />
                  {e.certificate_url && (
                    <Button size="sm" variant="secondary" onClick={() => window.open(e.certificate_url, '_blank')}>
                      <Download className="h-3.5 w-3.5" /> Certificate
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
