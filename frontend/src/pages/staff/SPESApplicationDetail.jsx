import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ArrowLeft, FileText } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'

import { Button } from '../../components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { useConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Dialog, DialogContent } from '../../components/ui/Dialog'
import { Textarea } from '../../components/ui/Input'
import { PageHeader } from '../../components/ui/PageHeader'
import { CardSkeleton } from '../../components/ui/Skeleton'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { useSocket } from '../../hooks/useSocket'
import api from '../../lib/axios'
import { manila } from '../../lib/manilaTime'
import { fadeIn } from '../../lib/motion'

export default function StaffSPESApplicationDetail() {
  const { id } = useParams()
  const queryClient = useQueryClient()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  const queryKey = ['staff', 'spes', 'applications', id]
  const { data: application, isLoading } = useQuery({
    queryKey,
    queryFn: async () => (await api.get(`/api/staff/spes/applications/${id}`)).data.data,
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey })
  useSocket({ 'spes:status_change': invalidate, 'spes:board_update': invalidate })

  const approve = useMutation({
    mutationFn: () => api.put(`/api/staff/spes/applications/${id}/approve`),
    onSuccess: () => {
      toast.success('Application approved for orientation.')
      invalidate()
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not approve this application.'),
  })

  const reject = useMutation({
    mutationFn: () => api.put(`/api/staff/spes/applications/${id}/reject`, { remarks: rejectReason }),
    onSuccess: () => {
      toast.success('Application rejected.')
      setRejectOpen(false)
      setRejectReason('')
      invalidate()
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not reject this application.'),
  })

  if (isLoading || !application) return <CardSkeleton />

  const history = [
    application.submitted_at && { label: 'Submitted', at: application.submitted_at },
    application.reviewed_at && { label: 'Reviewed', at: application.reviewed_at },
    application.orientation_outcome_at && { label: 'Orientation Outcome Recorded', at: application.orientation_outcome_at },
    application.exam_result_at && { label: 'Exam Result Recorded', at: application.exam_result_at },
  ].filter(Boolean)

  return (
    <motion.div {...fadeIn} className="space-y-4">
      <Link to="/staff/spes" className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-text-primary">
        <ArrowLeft className="h-4 w-4" /> Back to SPES Management
      </Link>

      <PageHeader title={application.full_name} description={`${application.batch_name} · Ref. ${application.application_ref_no}`} actions={<StatusBadge status={application.status} />} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader><CardTitle>Applicant Information</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-sm">
              <div><p className="text-text-muted">Full Name</p><p className="text-text-primary">{application.full_name}</p></div>
              <div><p className="text-text-muted">Email</p><p className="text-text-primary">{application.jobseeker_email || '—'}</p></div>
              <div><p className="text-text-muted">Age</p><p className="text-text-primary">{application.age}</p></div>
              <div><p className="text-text-muted">School</p><p className="text-text-primary">{application.school_name}</p></div>
              <div><p className="text-text-muted">Year Level</p><p className="text-text-primary">{application.year_level}</p></div>
              <div><p className="text-text-muted">GWA</p><p className="text-text-primary">{application.gwa}</p></div>
              <div><p className="text-text-muted">Family Income</p><p className="text-text-primary">₱{Number(application.family_income).toLocaleString()}</p></div>
              {application.review_remarks && (
                <div className="sm:col-span-2"><p className="text-text-muted">Review Remarks</p><p className="text-red-600">{application.review_remarks}</p></div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Uploaded Documents</CardTitle></CardHeader>
            <CardContent>
              {!application.document_urls?.length ? (
                <p className="text-xs text-text-muted">No supporting documents uploaded.</p>
              ) : (
                <div className="space-y-1">
                  {application.document_urls.map((d, i) => (
                    <a key={i} href={d.url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-sm text-primary-700 hover:underline">
                      <FileText className="h-3.5 w-3.5" /> {d.filename || 'View file'}
                    </a>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Status History</CardTitle></CardHeader>
            <CardContent>
              {!history.length ? (
                <p className="text-xs text-text-muted">No history yet.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {history.map((h) => (
                    <li key={h.label} className="flex items-center justify-between">
                      <span className="text-text-secondary">{h.label}</span>
                      <span className="text-text-muted">{manila(h.at).format('MMM D, YYYY h:mm A')}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader><CardTitle>Actions</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-2">
              {application.status === 'pending_review' ? (
                <>
                  <Button
                    onClick={() => confirm({
                      title: 'Approve for Orientation?',
                      description: 'The applicant will be notified. You can schedule orientation from the Schedules tab.',
                      confirmLabel: 'Approve',
                      onConfirm: () => approve.mutateAsync(),
                    })}
                  >
                    Approve for Orientation
                  </Button>
                  <Button variant="danger" onClick={() => setRejectOpen(true)}>Reject</Button>
                </>
              ) : (
                <p className="text-xs text-text-muted">This application has moved past review — no further review actions available.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {ConfirmDialogElement}

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent title="Reject Application">
          <div className="space-y-3">
            <p className="text-sm text-text-muted">The applicant will be emailed this reason. This cannot be undone.</p>
            <Textarea placeholder="Reason (required)" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
            <div className="flex justify-end">
              <Button variant="danger" onClick={() => reject.mutate()} disabled={reject.isPending || !rejectReason.trim()}>
                {reject.isPending ? 'Rejecting…' : 'Confirm Reject'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
