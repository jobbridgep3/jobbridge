import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { motion } from 'framer-motion'
import { ArrowLeft, FileText, Send } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'

import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { useConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Dialog, DialogContent } from '../../components/ui/Dialog'
import { Input, Textarea } from '../../components/ui/Input'
import { PageHeader } from '../../components/ui/PageHeader'
import { CardSkeleton } from '../../components/ui/Skeleton'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { useSocket } from '../../hooks/useSocket'
import api from '../../lib/axios'
import { fadeIn } from '../../lib/motion'
import { cn } from '../../lib/utils'

const STEPS = [
  { key: 'pending', label: 'Pending', dateField: 'submitted_at' },
  { key: 'verified', label: 'Verified', dateField: 'verified_at' },
  { key: 'submitted_to_owwa', label: 'Submitted to OWWA', dateField: 'submitted_to_owwa_at' },
  { key: 'for_owwa_response', label: 'Awaiting Response', dateField: 'for_owwa_response_at' },
  { key: 'completed', label: 'Completed', dateField: 'completed_at' },
]

function OwwaStepper({ owwaRequest }) {
  if (owwaRequest.status === 'declined') return null
  const currentIndex = Math.max(0, STEPS.findIndex((s) => s.key === owwaRequest.status))
  return (
    <ol className="flex items-center gap-1.5">
      {STEPS.map((step, i) => (
        <li key={step.key} className="flex flex-1 items-center gap-1.5">
          <div className="flex flex-col items-center gap-1">
            <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold', i <= currentIndex ? 'bg-primary-800 text-white' : 'bg-surface-hover text-text-muted')}>
              {i + 1}
            </span>
            <span className={cn('hidden text-center text-[10px] sm:block', i <= currentIndex ? 'text-text-primary' : 'text-text-muted')}>
              {step.label}
              {owwaRequest[step.dateField] && <span className="block text-text-muted">{dayjs(owwaRequest[step.dateField]).format('MMM D')}</span>}
            </span>
          </div>
          {i < STEPS.length - 1 && <div className={cn('h-0.5 flex-1', i < currentIndex ? 'bg-primary-800' : 'bg-surface-hover')} />}
        </li>
      ))}
    </ol>
  )
}

function DocumentChecklist({ documents }) {
  const types = [
    { type: 'application_form', label: 'Application Form' },
    { type: 'supporting_document', label: 'Supporting Documents' },
  ]
  return (
    <div className="space-y-3">
      {types.map(({ type, label }) => {
        const docs = documents.filter((d) => d.document_type === type)
        return (
          <div key={type} className="rounded-lg border border-border p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-text-primary">{label}</span>
              <Badge variant={docs.length ? 'success' : 'danger'}>{docs.length ? `${docs.length} uploaded` : 'Missing'}</Badge>
            </div>
            {docs.length > 0 ? (
              <div className="space-y-1">
                {docs.map((d) => (
                  <a key={d.id} href={d.file_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-sm text-primary-700 hover:underline">
                    <FileText className="h-3.5 w-3.5" /> {d.original_filename || 'View file'}
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-xs text-text-muted">No file uploaded yet.</p>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function StaffOWWARequestDetail() {
  const { id } = useParams()
  const queryClient = useQueryClient()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const [declineOpen, setDeclineOpen] = useState(false)
  const [declineReason, setDeclineReason] = useState('')
  const [completeOpen, setCompleteOpen] = useState(false)
  const [releaseInstructions, setReleaseInstructions] = useState('')
  const [remarkText, setRemarkText] = useState('')

  const queryKey = ['staff', 'owwa', id]
  const { data: owwaRequest, isLoading } = useQuery({
    queryKey,
    queryFn: async () => (await api.get(`/api/staff/owwa/${id}`)).data.data,
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey })
  useSocket({ 'owwa:board_update': invalidate })

  const runAction = useMutation({
    mutationFn: ({ action, body }) => api.put(`/api/staff/owwa/${id}/${action}`, body),
    onSuccess: (_, { successMessage }) => {
      toast.success(successMessage)
      invalidate()
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Action failed.'),
  })

  const decline = useMutation({
    mutationFn: () => api.put(`/api/staff/owwa/${id}/decline`, { reason: declineReason }),
    onSuccess: () => {
      toast.success('Request marked declined.')
      setDeclineOpen(false)
      setDeclineReason('')
      invalidate()
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not decline request.'),
  })

  const complete = useMutation({
    mutationFn: () => api.put(`/api/staff/owwa/${id}/complete`, { release_instructions: releaseInstructions }),
    onSuccess: () => {
      toast.success('Request marked completed.')
      setCompleteOpen(false)
      setReleaseInstructions('')
      invalidate()
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not mark request completed.'),
  })

  const addRemark = useMutation({
    mutationFn: () => api.post(`/api/staff/owwa/${id}/remarks`, { remark: remarkText }),
    onSuccess: () => {
      toast.success('Remark added.')
      setRemarkText('')
      invalidate()
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not add remark.'),
  })

  if (isLoading || !owwaRequest) return <CardSkeleton />

  const confirmTransition = (action, { title, description, successMessage }) =>
    confirm({
      title, description, confirmLabel: 'Confirm',
      onConfirm: () => runAction.mutateAsync({ action, body: {}, successMessage }),
    })

  return (
    <motion.div {...fadeIn} className="space-y-4">
      <Link to="/staff/owwa" className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-text-primary">
        <ArrowLeft className="h-4 w-4" /> Back to OWWA Requests
      </Link>

      <PageHeader
        title={owwaRequest.jobseeker_name}
        description={owwaRequest.ofw_relationship}
        actions={<StatusBadge status={owwaRequest.status} />}
      />

      <Card>
        <CardContent><OwwaStepper owwaRequest={owwaRequest} /></CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader><CardTitle>Applicant Information</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-sm">
              <div><p className="text-text-muted">Full Name</p><p className="text-text-primary">{owwaRequest.jobseeker_name}</p></div>
              <div><p className="text-text-muted">Contact Number</p><p className="text-text-primary">{owwaRequest.jobseeker_contact || '—'}</p></div>
              <div><p className="text-text-muted">Email</p><p className="text-text-primary">{owwaRequest.jobseeker_email || '—'}</p></div>
              <div><p className="text-text-muted">OFW Status / Relationship</p><p className="text-text-primary">{owwaRequest.ofw_relationship}</p></div>
              {owwaRequest.notes && <div className="sm:col-span-2"><p className="text-text-muted">Supporting Details</p><p className="text-text-primary">{owwaRequest.notes}</p></div>}
              {owwaRequest.status === 'declined' && owwaRequest.declined_reason && (
                <div className="sm:col-span-2"><p className="text-text-muted">Declined Reason</p><p className="text-red-600">{owwaRequest.declined_reason}</p></div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Uploaded Documents</CardTitle></CardHeader>
            <CardContent><DocumentChecklist documents={owwaRequest.documents || []} /></CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Internal Remarks</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {!owwaRequest.remarks?.length ? (
                <p className="text-xs text-text-muted">No remarks yet. Internal notes are not shared with the applicant.</p>
              ) : (
                <div className="space-y-2">
                  {owwaRequest.remarks.map((r) => (
                    <div key={r.id} className="rounded-lg border border-border-subtle p-3">
                      <p className="text-sm text-text-primary">{r.remark}</p>
                      <p className="mt-1 text-xs text-text-muted">{r.staff_name} — {dayjs(r.created_at).format('MMM D, YYYY h:mm A')}</p>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Input placeholder="Add an internal note…" value={remarkText} onChange={(e) => setRemarkText(e.target.value)} />
                <Button size="sm" onClick={() => addRemark.mutate()} disabled={addRemark.isPending || !remarkText.trim()}>Add</Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader><CardTitle>Actions</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-2">
              {owwaRequest.status === 'pending' && (
                <Button onClick={() => confirmTransition('verify', {
                  title: 'Mark as Verified?',
                  description: 'Confirms you have reviewed the documents and called the OWWA Hotline to verify eligibility. The applicant will be emailed.',
                  successMessage: 'Request marked as verified.',
                })}>
                  Mark as Verified
                </Button>
              )}
              {owwaRequest.status === 'verified' && (
                <Button onClick={() => confirmTransition('submit-to-owwa', {
                  title: 'Submit to OWWA?',
                  description: 'Confirms you have finalized and submitted this application to OWWA Region IV-A. The applicant will be emailed.',
                  successMessage: 'Request submitted to OWWA.',
                })}>
                  <Send className="h-4 w-4" /> Submit to OWWA
                </Button>
              )}
              {owwaRequest.status === 'submitted_to_owwa' && (
                <Button variant="secondary" onClick={() => confirmTransition('follow-up', {
                  title: 'Mark as Awaiting Response?',
                  description: 'Use this if follow-up with OWWA is taking multiple days. The applicant will be emailed a status update.',
                  successMessage: 'Request marked as awaiting OWWA response.',
                })}>
                  Follow Up Status
                </Button>
              )}
              {['submitted_to_owwa', 'for_owwa_response'].includes(owwaRequest.status) && (
                <Button onClick={() => setCompleteOpen(true)}>Mark Completed</Button>
              )}
              {['pending', 'verified', 'submitted_to_owwa', 'for_owwa_response'].includes(owwaRequest.status) && (
                <Button variant="danger" onClick={() => setDeclineOpen(true)}>Mark Declined</Button>
              )}
              {['completed', 'declined'].includes(owwaRequest.status) && (
                <p className="text-xs text-text-muted">This request is closed — no further actions available.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {ConfirmDialogElement}

      <Dialog open={declineOpen} onOpenChange={setDeclineOpen}>
        <DialogContent title="Mark Request Declined">
          <div className="space-y-3">
            <p className="text-sm text-text-muted">The applicant will be emailed this reason. This cannot be undone.</p>
            <Textarea placeholder="Reason (required)" value={declineReason} onChange={(e) => setDeclineReason(e.target.value)} />
            <div className="flex justify-end">
              <Button variant="danger" onClick={() => decline.mutate()} disabled={decline.isPending || !declineReason.trim()}>
                {decline.isPending ? 'Declining…' : 'Confirm Decline'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <DialogContent title="Mark Request Completed">
          <div className="space-y-3">
            <p className="text-sm text-text-muted">The applicant will be emailed. Optionally add release/next-step instructions to include in that email.</p>
            <Textarea
              placeholder="e.g. Please proceed to the PESO Pila office to coordinate the next steps for claiming your assistance."
              value={releaseInstructions}
              onChange={(e) => setReleaseInstructions(e.target.value)}
            />
            <div className="flex justify-end">
              <Button onClick={() => complete.mutate()} disabled={complete.isPending}>
                {complete.isPending ? 'Completing…' : 'Confirm Completed'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
