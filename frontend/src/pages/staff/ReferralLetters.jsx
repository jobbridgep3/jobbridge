import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { motion } from 'framer-motion'
import { Check, Download, X } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'

import { Button } from '../../components/ui/Button'
import { DataTable } from '../../components/ui/DataTable'
import { Dialog, DialogContent } from '../../components/ui/Dialog'
import { Label, Select, Textarea } from '../../components/ui/Input'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { useSocket } from '../../hooks/useSocket'
import api from '../../lib/axios'
import { fadeIn } from '../../lib/motion'

export default function StaffReferralLetters() {
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('requested')
  const [rejectTarget, setRejectTarget] = useState(null)
  const [rejectReason, setRejectReason] = useState('')

  const params = statusFilter ? { status: statusFilter } : {}
  const { data: letters, isLoading } = useQuery({
    queryKey: ['staff', 'referral-letters', statusFilter],
    queryFn: async () => (await api.get('/api/staff/referral-letters', { params })).data.data,
  })

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['staff', 'referral-letters'] })
  useSocket({ 'referral:requested': refresh })

  const approve = useMutation({
    mutationFn: (id) => api.put(`/api/staff/referral-letters/${id}/approve`),
    onSuccess: () => {
      toast.success('Approved — referral letter generated and jobseeker notified.')
      refresh()
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not approve request.'),
  })

  const reject = useMutation({
    mutationFn: ({ id, reason }) => api.put(`/api/staff/referral-letters/${id}/reject`, { reason }),
    onSuccess: () => {
      toast.success('Request rejected — jobseeker notified.')
      setRejectTarget(null)
      setRejectReason('')
      refresh()
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not reject request.'),
  })

  const columns = [
    { accessorKey: 'jobseeker_name', header: 'Jobseeker' },
    {
      id: 'target',
      header: 'Referral For',
      cell: ({ row }) =>
        row.original.job_title ? (
          <span>
            {row.original.job_title}
            {row.original.company_name ? <span className="text-slate-500"> — {row.original.company_name}</span> : null}
          </span>
        ) : (
          <span className="italic text-slate-500">General referral</span>
        ),
    },
    {
      accessorKey: 'reason',
      header: 'Purpose',
      cell: ({ row }) => <span className="block max-w-[220px] truncate">{row.original.reason || '—'}</span>,
    },
    { accessorKey: 'created_at', header: 'Requested', cell: ({ row }) => dayjs(row.original.created_at).format('MMM D, YYYY') },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} label={row.original.status === 'requested' ? 'Pending Review' : undefined} /> },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex justify-end gap-2">
          {row.original.status === 'requested' && (
            <>
              <Button
                size="sm"
                onClick={() => approve.mutate(row.original.id)}
                disabled={approve.isPending && approve.variables === row.original.id}
              >
                <Check className="h-3.5 w-3.5" />
                {approve.isPending && approve.variables === row.original.id ? 'Approving…' : 'Approve'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setRejectTarget(row.original)}>
                <X className="h-3.5 w-3.5" /> Reject
              </Button>
            </>
          )}
          {row.original.pdf_url && (
            <Button size="sm" variant="secondary" onClick={() => window.open(row.original.pdf_url, '_blank')}>
              <Download className="h-3.5 w-3.5" /> PDF
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <motion.div {...fadeIn} className="space-y-4">
      <PageHeader
        title="Referral Letters"
        description="Review jobseeker referral letter requests — approving generates the official PESO letter."
        actions={
          <div className="w-44">
            <Label>Status</Label>
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="requested">Pending Review</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="">All</option>
            </Select>
          </div>
        }
      />

      <DataTable
        columns={columns}
        data={letters}
        isLoading={isLoading}
        searchPlaceholder="Search requests…"
        emptyTitle="No referral letter requests"
        emptyDescription="Jobseeker requests will appear here for review."
      />

      <Dialog open={!!rejectTarget} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <DialogContent title="Reject Referral Request">
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Rejecting <b>{rejectTarget?.jobseeker_name}</b>'s request
              {rejectTarget?.job_title ? ` for ${rejectTarget.job_title}` : ''}. The jobseeker will be notified with your reason.
            </p>
            <div>
              <Label>Reason</Label>
              <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Why is this request being rejected?" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setRejectTarget(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                disabled={!rejectReason.trim() || (reject.isPending && reject.variables?.id === rejectTarget?.id)}
                onClick={() => reject.mutate({ id: rejectTarget.id, reason: rejectReason.trim() })}
              >
                {reject.isPending && reject.variables?.id === rejectTarget?.id ? 'Rejecting…' : 'Reject Request'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
