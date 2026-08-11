import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { motion } from 'framer-motion'
import { Layers } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'

import { Button } from '../../components/ui/Button'
import { Card, CardContent } from '../../components/ui/Card'
import { Dialog, DialogContent } from '../../components/ui/Dialog'
import { EmptyState } from '../../components/ui/EmptyState'
import { Input, Label } from '../../components/ui/Input'
import { PageHeader } from '../../components/ui/PageHeader'
import { CardSkeleton } from '../../components/ui/Skeleton'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { useSocket } from '../../hooks/useSocket'
import api from '../../lib/axios'
import { fadeIn, staggerContainer, staggerItem } from '../../lib/motion'

export default function StaffTrainingReferralBatches() {
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [batchName, setBatchName] = useState('')
  const [minPax, setMinPax] = useState(15)

  const { data: batches, isLoading } = useQuery({
    queryKey: ['staff', 'training_referral', 'batches'],
    queryFn: async () => (await api.get('/api/staff/training-referral/batches')).data.data,
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['staff', 'training_referral'] })
  useSocket({
    'training_referral:status_change': invalidate,
    'training_referral:board_update': invalidate,
  })

  const create = useMutation({
    mutationFn: () => api.post('/api/staff/training-referral/batches', { batch_name: batchName, min_pax: Number(minPax) || 15 }),
    onSuccess: () => {
      toast.success('Batch created.')
      setCreateOpen(false)
      setBatchName('')
      setMinPax(15)
      queryClient.invalidateQueries({ queryKey: ['staff', 'training_referral', 'batches'] })
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not create batch.'),
  })

  return (
    <motion.div {...fadeIn} className="space-y-4">
      <PageHeader
        title="ManPower Skills Management — Batches"
        description="Pool of applicants formalized for TESDA project proposal submission."
        actions={
          <>
            <Link to="/staff/training-referral/queue">
              <Button variant="secondary" size="sm">Applications Queue</Button>
            </Link>
            <Button size="sm" onClick={() => setCreateOpen(true)}>Create New Batch</Button>
          </>
        }
      />

      {isLoading ? (
        <CardSkeleton />
      ) : !batches?.length ? (
        <EmptyState icon={Layers} title="No batches yet" description="Create a batch, then pool applicants into it from the Applications Queue." />
      ) : (
        <motion.div variants={staggerContainer} initial="initial" animate="animate" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {batches.map((batch) => (
            <motion.div key={batch.id} variants={staggerItem}>
              <Link to={`/staff/training-referral/batches/${batch.id}`}>
                <Card hover className="cursor-pointer">
                  <CardContent className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-text-primary">{batch.batch_name}</p>
                      <StatusBadge status={batch.status} />
                    </div>
                    <ProgressBar percent={Math.round((batch.current_pax / batch.min_pax) * 100)} label={`${batch.current_pax}/${batch.min_pax} pax`} />
                    <p className="text-xs text-text-muted">Created {dayjs(batch.created_at).format('MMM D, YYYY')}</p>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent title="Create New Batch">
          <div className="space-y-3">
            <div>
              <Label>Batch Name</Label>
              <Input value={batchName} onChange={(e) => setBatchName(e.target.value)} placeholder="e.g. Batch 2026-08 — Welding NC II" />
            </div>
            <div>
              <Label>Minimum Pax</Label>
              <Input type="number" min={1} value={minPax} onChange={(e) => setMinPax(e.target.value)} />
            </div>
            <div className="flex justify-end">
              <Button onClick={() => create.mutate()} disabled={create.isPending || !batchName.trim()}>
                {create.isPending ? 'Creating…' : 'Create Batch'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
