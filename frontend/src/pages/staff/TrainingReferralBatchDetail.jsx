import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { motion } from 'framer-motion'
import { ArrowLeft, FileText, Upload } from 'lucide-react'
import { useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Link, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'

import { Button } from '../../components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { Dialog, DialogContent } from '../../components/ui/Dialog'
import { EmptyState } from '../../components/ui/EmptyState'
import { Textarea } from '../../components/ui/Input'
import { PageHeader } from '../../components/ui/PageHeader'
import { CardSkeleton } from '../../components/ui/Skeleton'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { useSocket } from '../../hooks/useSocket'
import api from '../../lib/axios'
import { fadeIn } from '../../lib/motion'

export default function StaffTrainingReferralBatchDetail() {
  const { id } = useParams()
  const queryClient = useQueryClient()
  const [declineTarget, setDeclineTarget] = useState(null)
  const [declineRemarks, setDeclineRemarks] = useState('')
  const [batchDeclineOpen, setBatchDeclineOpen] = useState(false)
  const [batchDeclineRemarks, setBatchDeclineRemarks] = useState('')

  const queryKey = ['staff', 'training_referral', 'batches', id]
  const { data: batch, isLoading } = useQuery({
    queryKey,
    queryFn: async () => (await api.get(`/api/staff/training-referral/batches/${id}`)).data.data,
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey })
  useSocket({
    'training_referral:status_change': invalidate,
    'training_referral:board_update': invalidate,
  })

  const uploadProposal = useMutation({
    mutationFn: (file) => {
      const fd = new FormData()
      fd.append('file', file)
      return api.post(`/api/staff/training-referral/batches/${id}/upload-proposal`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    },
    onSuccess: () => {
      toast.success('Project proposal uploaded.')
      invalidate()
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Upload failed.'),
  })

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    maxFiles: 1,
    onDrop: (accepted) => accepted.length && uploadProposal.mutate(accepted[0]),
  })

  const declineApplicant = useMutation({
    mutationFn: () => api.post(`/api/staff/training-referral/applications/${declineTarget.id}/decline`, { remarks: declineRemarks }),
    onSuccess: () => {
      toast.success('Applicant declined.')
      setDeclineTarget(null)
      setDeclineRemarks('')
      invalidate()
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not decline applicant.'),
  })

  const runAction = useMutation({
    mutationFn: (action) => api.put(`/api/staff/training-referral/batches/${id}/${action}`),
    onSuccess: (_, action) => {
      toast.success(
        { 'submit-to-tesda': 'Batch submitted to TESDA.', 'follow-up': 'Marked as awaiting response.', complete: 'Batch marked completed.' }[action]
      )
      invalidate()
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Action failed.'),
  })

  const declineBatch = useMutation({
    mutationFn: () => api.put(`/api/staff/training-referral/batches/${id}/decline`, { remarks: batchDeclineRemarks }),
    onSuccess: () => {
      toast.success('Batch marked declined.')
      setBatchDeclineOpen(false)
      setBatchDeclineRemarks('')
      invalidate()
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not decline batch.'),
  })

  if (isLoading || !batch) return <CardSkeleton />

  const canSubmit = batch.status === 'forming' && batch.current_pax >= batch.min_pax && batch.project_proposal_url
  const canFollowUp = batch.status === 'submitted_to_tesda'
  const canResolve = batch.status === 'submitted_to_tesda' || batch.status === 'for_tesda_response'
  const pooled = batch.applications?.filter((a) => a.status !== 'declined') || []
  const declined = batch.applications?.filter((a) => a.status === 'declined') || []

  return (
    <motion.div {...fadeIn} className="space-y-4">
      <Link to="/staff/training-referral/batches" className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-text-primary">
        <ArrowLeft className="h-4 w-4" /> Back to Batches
      </Link>

      <PageHeader
        title={batch.batch_name}
        description={`Status: ${batch.status.replace(/_/g, ' ')}`}
        actions={<StatusBadge status={batch.status} />}
      />

      <Card>
        <CardContent className="space-y-3">
          <ProgressBar percent={Math.round((batch.current_pax / batch.min_pax) * 100)} label={`${batch.current_pax}/${batch.min_pax} pax pooled`} />
          {batch.submitted_to_tesda_date && (
            <p className="text-xs text-text-muted">Submitted to TESDA {dayjs(batch.submitted_to_tesda_date).format('MMM D, YYYY')}</p>
          )}
          {batch.tesda_response_date && (
            <p className="text-xs text-text-muted">TESDA response {dayjs(batch.tesda_response_date).format('MMM D, YYYY')}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Project Proposal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {batch.project_proposal_url && (
            <a href={batch.project_proposal_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-sm text-primary-700 hover:underline">
              <FileText className="h-4 w-4" /> View uploaded proposal
            </a>
          )}
          {batch.status === 'forming' && (
            <div
              {...getRootProps()}
              className={`cursor-pointer rounded-lg border border-dashed p-4 text-center transition-colors ${
                isDragActive ? 'border-primary-400 bg-primary-50' : 'border-slate-200 hover:border-primary-300'
              }`}
            >
              <input {...getInputProps()} />
              <p className="flex items-center justify-center gap-1.5 text-xs text-slate-500">
                <Upload className="h-3.5 w-3.5" /> {batch.project_proposal_url ? 'Replace proposal document' : 'Upload proposal document'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button disabled={!canSubmit || runAction.isPending} onClick={() => runAction.mutate('submit-to-tesda')}>
            Submit to TESDA
          </Button>
          <Button variant="secondary" disabled={!canFollowUp || runAction.isPending} onClick={() => runAction.mutate('follow-up')}>
            Follow Up Status
          </Button>
          <Button variant="secondary" disabled={!canResolve || runAction.isPending} onClick={() => runAction.mutate('complete')}>
            Mark Completed
          </Button>
          <Button variant="danger" disabled={!canResolve} onClick={() => setBatchDeclineOpen(true)}>
            Mark Declined
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pooled Applicants ({pooled.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {!pooled.length ? (
            <EmptyState title="No applicants pooled yet" description="Add applicants from the Applications Queue." />
          ) : (
            pooled.map((app) => (
              <div key={app.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm font-medium text-text-primary">{app.jobseeker_name}</p>
                  <p className="text-xs text-text-muted">{app.program_interest}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={app.status} />
                  {batch.status === 'forming' && (
                    <Button variant="danger" size="sm" onClick={() => setDeclineTarget(app)}>Remove</Button>
                  )}
                </div>
              </div>
            ))
          )}
          {declined.length > 0 && (
            <details className="pt-2">
              <summary className="cursor-pointer text-xs text-text-muted">{declined.length} declined applicant(s)</summary>
              <div className="mt-2 space-y-2">
                {declined.map((app) => (
                  <div key={app.id} className="rounded-lg border border-border-subtle p-3 opacity-70">
                    <p className="text-sm font-medium text-text-primary">{app.jobseeker_name}</p>
                    <p className="text-xs text-red-600">{app.remarks}</p>
                  </div>
                ))}
              </div>
            </details>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!declineTarget} onOpenChange={(open) => !open && setDeclineTarget(null)}>
        <DialogContent title={`Decline ${declineTarget?.jobseeker_name}`}>
          <div className="space-y-3">
            <Textarea placeholder="Reason for declining (required)" value={declineRemarks} onChange={(e) => setDeclineRemarks(e.target.value)} />
            <div className="flex justify-end">
              <Button variant="danger" onClick={() => declineApplicant.mutate()} disabled={declineApplicant.isPending || !declineRemarks.trim()}>
                Decline Applicant
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={batchDeclineOpen} onOpenChange={setBatchDeclineOpen}>
        <DialogContent title="Mark Batch Declined">
          <div className="space-y-3">
            <p className="text-sm text-text-muted">This marks the batch and every pooled applicant as declined. This cannot be undone.</p>
            <Textarea placeholder="Reason (required)" value={batchDeclineRemarks} onChange={(e) => setBatchDeclineRemarks(e.target.value)} />
            <div className="flex justify-end">
              <Button variant="danger" onClick={() => declineBatch.mutate()} disabled={declineBatch.isPending || !batchDeclineRemarks.trim()}>
                Confirm Decline
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
