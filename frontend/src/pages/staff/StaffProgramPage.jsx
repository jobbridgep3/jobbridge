import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { motion } from 'framer-motion'
import { Download, FileText } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'

import { Button } from '../../components/ui/Button'
import { Card, CardContent } from '../../components/ui/Card'
import { Dialog, DialogContent } from '../../components/ui/Dialog'
import { EmptyState } from '../../components/ui/EmptyState'
import { Textarea } from '../../components/ui/Input'
import { PageHeader } from '../../components/ui/PageHeader'
import { CardSkeleton } from '../../components/ui/Skeleton'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { useSocket } from '../../hooks/useSocket'
import api from '../../lib/axios'
import { fadeIn, staggerContainer, staggerItem } from '../../lib/motion'

/** Shared Staff/Admin review UI for SPES / DILP / OWWA — mirrors the shared backend model. */
export function StaffProgramPage({ programType, title, description }) {
  const queryClient = useQueryClient()
  const [reviewTarget, setReviewTarget] = useState(null)
  const [remarks, setRemarks] = useState('')

  const { data: applications, isLoading } = useQuery({
    queryKey: ['staff', programType],
    queryFn: async () => (await api.get(`/api/staff/${programType}`)).data.data,
  })

  useSocket({ 'program:status_change': (p) => p.type === programType && queryClient.invalidateQueries({ queryKey: ['staff', programType] }) })

  const approve = useMutation({
    mutationFn: (id) => api.put(`/api/staff/${programType}/${id}/approve`, { remarks }),
    onSuccess: () => {
      toast.success('Application approved.')
      setReviewTarget(null)
      setRemarks('')
      queryClient.invalidateQueries({ queryKey: ['staff', programType] })
    },
  })

  const reject = useMutation({
    mutationFn: (id) => api.put(`/api/staff/${programType}/${id}/reject`, { remarks }),
    onSuccess: () => {
      toast.success('Application rejected.')
      setReviewTarget(null)
      setRemarks('')
      queryClient.invalidateQueries({ queryKey: ['staff', programType] })
    },
  })

  return (
    <motion.div {...fadeIn} className="space-y-4">
      <PageHeader
        title={title}
        description={description}
        actions={
          <Button variant="secondary" size="sm" onClick={() => window.open(`${api.defaults.baseURL}/api/staff/${programType}/report`, '_blank')}>
            <Download className="h-4 w-4" /> Export Report
          </Button>
        }
      />

      {isLoading ? (
        <CardSkeleton />
      ) : !applications?.length ? (
        <EmptyState icon={FileText} title="No applications submitted yet" />
      ) : (
        <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-3">
          {applications.map((app) => (
            <motion.div key={app.id} variants={staggerItem}>
              <Card>
                <CardContent className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{app.jobseeker_name}</p>
                    <p className="text-xs text-slate-400">Submitted {dayjs(app.created_at).format('MMM D, YYYY')}</p>
                    <p className="text-xs text-slate-500">{app.document_urls?.length || 0} document(s) uploaded</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={app.status} />
                    {app.status === 'submitted' && (
                      <Button size="sm" onClick={() => setReviewTarget(app)}>
                        Review
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}

      <Dialog open={!!reviewTarget} onOpenChange={(open) => !open && setReviewTarget(null)}>
        <DialogContent title={`Review ${reviewTarget?.jobseeker_name}'s Application`}>
          <div className="space-y-3">
            <pre className="max-h-40 overflow-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
              {JSON.stringify(reviewTarget?.form_data, null, 2)}
            </pre>
            <Textarea placeholder="Remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
            <div className="flex justify-end gap-2">
              <Button variant="danger" onClick={() => reject.mutate(reviewTarget.id)} disabled={reject.isPending}>
                Reject
              </Button>
              <Button onClick={() => approve.mutate(reviewTarget.id)} disabled={approve.isPending}>
                Approve
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
