import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { motion } from 'framer-motion'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'

import { Button } from '../../components/ui/Button'
import { DataTable } from '../../components/ui/DataTable'
import { Dialog, DialogContent } from '../../components/ui/Dialog'
import { Input, Label, Select, Textarea } from '../../components/ui/Input'
import { PageHeader } from '../../components/ui/PageHeader'
import { useSocket } from '../../hooks/useSocket'
import api from '../../lib/axios'
import { fadeIn } from '../../lib/motion'

export default function StaffTrainingReferralQueue() {
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState(new Set())
  const [poolDialogOpen, setPoolDialogOpen] = useState(false)
  const [targetBatchId, setTargetBatchId] = useState('')
  const [newBatchName, setNewBatchName] = useState('')
  const [declineTarget, setDeclineTarget] = useState(null)
  const [declineRemarks, setDeclineRemarks] = useState('')

  const { data: applications, isLoading } = useQuery({
    queryKey: ['staff', 'training_referral', 'queue'],
    queryFn: async () => (await api.get('/api/staff/training-referral/queue')).data.data,
  })

  const { data: formingBatches } = useQuery({
    queryKey: ['staff', 'training_referral', 'batches', 'forming'],
    queryFn: async () => (await api.get('/api/staff/training-referral/batches?status=forming')).data.data,
    enabled: poolDialogOpen,
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['staff', 'training_referral'] })
  useSocket({
    'training_referral:status_change': invalidate,
    'training_referral:board_update': invalidate,
  })

  const pool = useMutation({
    mutationFn: async () => {
      let batchId = targetBatchId
      if (batchId === '__new__') {
        const res = await api.post('/api/staff/training-referral/batches', { batch_name: newBatchName })
        batchId = res.data.data.id
      }
      return api.post(`/api/staff/training-referral/batches/${batchId}/pool`, { application_ids: [...selected] })
    },
    onSuccess: () => {
      toast.success('Applicants pooled into batch.')
      setPoolDialogOpen(false)
      setSelected(new Set())
      setTargetBatchId('')
      setNewBatchName('')
      invalidate()
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not pool applicants.'),
  })

  const decline = useMutation({
    mutationFn: () => api.post(`/api/staff/training-referral/applications/${declineTarget.id}/decline`, { remarks: declineRemarks }),
    onSuccess: () => {
      toast.success('Applicant declined.')
      setDeclineTarget(null)
      setDeclineRemarks('')
      invalidate()
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not decline applicant.'),
  })

  const toggle = (id) => {
    const next = new Set(selected)
    next.has(id) ? next.delete(id) : next.add(id)
    setSelected(next)
  }

  const columns = [
    {
      id: 'select',
      header: '',
      cell: ({ row }) => (
        <input type="checkbox" className="h-4 w-4" checked={selected.has(row.original.id)} onChange={() => toggle(row.original.id)} />
      ),
    },
    { accessorKey: 'jobseeker_name', header: 'Jobseeker' },
    { accessorKey: 'program_interest', header: 'Program Interest' },
    {
      accessorKey: 'application_date',
      header: 'Date Applied',
      cell: ({ row }) => dayjs(row.original.application_date || row.original.created_at).format('MMM D, YYYY'),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <Button variant="danger" size="sm" onClick={() => setDeclineTarget(row.original)}>
          Decline
        </Button>
      ),
    },
  ]

  return (
    <motion.div {...fadeIn} className="space-y-4">
      <PageHeader
        title="ManPower Skills Management"
        description="Pool pending applicants into batches before submitting a project proposal to TESDA."
        actions={
          <>
            <Link to="/staff/training-referral/batches">
              <Button variant="secondary" size="sm">View Batches</Button>
            </Link>
            <Button size="sm" disabled={!selected.size} onClick={() => setPoolDialogOpen(true)}>
              Add {selected.size || ''} to Batch
            </Button>
          </>
        }
      />

      <DataTable
        columns={columns}
        data={applications}
        isLoading={isLoading}
        searchPlaceholder="Search jobseeker or program…"
        emptyTitle="No pending applications"
        emptyDescription="New applicants will appear here for pooling into a batch."
      />

      <Dialog open={poolDialogOpen} onOpenChange={setPoolDialogOpen}>
        <DialogContent title={`Add ${selected.size} applicant(s) to a batch`}>
          <div className="space-y-3">
            <div>
              <Label>Batch</Label>
              <Select value={targetBatchId} onChange={(e) => setTargetBatchId(e.target.value)}>
                <option value="">Select a batch…</option>
                {formingBatches?.map((b) => (
                  <option key={b.id} value={b.id}>{b.batch_name} ({b.current_pax}/{b.min_pax})</option>
                ))}
                <option value="__new__">+ Create New Batch</option>
              </Select>
            </div>
            {targetBatchId === '__new__' && (
              <div>
                <Label>New Batch Name</Label>
                <Input value={newBatchName} onChange={(e) => setNewBatchName(e.target.value)} placeholder="e.g. Batch 2026-08 — Welding NC II" />
              </div>
            )}
            <div className="flex justify-end">
              <Button
                onClick={() => pool.mutate()}
                disabled={pool.isPending || !targetBatchId || (targetBatchId === '__new__' && !newBatchName.trim())}
              >
                {pool.isPending ? 'Adding…' : 'Add to Batch'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!declineTarget} onOpenChange={(open) => !open && setDeclineTarget(null)}>
        <DialogContent title={`Decline ${declineTarget?.jobseeker_name}`}>
          <div className="space-y-3">
            <Textarea placeholder="Reason for declining (required)" value={declineRemarks} onChange={(e) => setDeclineRemarks(e.target.value)} />
            <div className="flex justify-end">
              <Button variant="danger" onClick={() => decline.mutate()} disabled={decline.isPending || !declineRemarks.trim()}>
                Decline Applicant
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
