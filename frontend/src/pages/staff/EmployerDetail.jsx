import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ArrowLeft, CheckCircle2, FileText, Trash2, XCircle } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Dialog, DialogContent } from '../../components/ui/Dialog'
import { Label, Textarea } from '../../components/ui/Input'
import { CardSkeleton } from '../../components/ui/Skeleton'
import { StatusBadge } from '../../components/ui/StatusBadge'
import api from '../../lib/axios'
import { fadeIn } from '../../lib/motion'
import { useAuthStore } from '../../store/authStore'
import { COMPANY_DOCUMENT_TYPES } from '../employer/company-sections/options'

export default function StaffEmployerDetail({ basePath = '/staff' }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const role = useAuthStore((s) => s.user?.role)
  const [confirmVerify, setConfirmVerify] = useState(null) // true | false | null
  const [confirmSuspend, setConfirmSuspend] = useState(false)
  const [confirmReinstate, setConfirmReinstate] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [rejectRemarks, setRejectRemarks] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [reviewingDoc, setReviewingDoc] = useState(null) // { id, label } | null
  const [docRejectReason, setDocRejectReason] = useState('')

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['staff', 'employers', id] })

  const { data: company, isLoading } = useQuery({
    queryKey: ['staff', 'employers', id],
    queryFn: async () => (await api.get(`/api/staff/employers/${id}`)).data.data,
  })

  const verify = useMutation({
    mutationFn: (approve) => api.put(`/api/staff/employers/${id}/verify`, { approve, remarks: !approve ? rejectRemarks : undefined }),
    onSuccess: () => {
      toast.success('Employer accreditation updated.')
      setConfirmVerify(null)
      setRejectRemarks('')
      invalidate()
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not update accreditation.'),
  })

  const suspend = useMutation({
    mutationFn: () => api.put(`/api/staff/employers/${id}/suspend`),
    onSuccess: () => { toast.success('Employer suspended.'); setConfirmSuspend(false); invalidate() },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not suspend this account.'),
  })

  const reinstate = useMutation({
    mutationFn: () => api.put(`/api/staff/employers/${id}/reinstate`),
    onSuccess: () => { toast.success('Employer reinstated.'); setConfirmReinstate(false); invalidate() },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not reinstate this account.'),
  })

  const reviewDocument = useMutation({
    mutationFn: ({ documentId, status, rejection_reason }) =>
      api.put(`/api/staff/employers/${id}/documents/${documentId}/review`, { status, rejection_reason }),
    onSuccess: () => {
      toast.success('Document review updated.')
      setReviewingDoc(null)
      setDocRejectReason('')
      invalidate()
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not update document review.'),
  })

  const deleteAccount = async () => {
    setDeleting(true)
    try {
      await api.delete(`/api/staff/employers/${id}`)
      toast.success('Employer account permanently deleted.')
      queryClient.invalidateQueries({ queryKey: ['staff', 'employers'] })
      navigate(`${basePath}/employers`)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not delete this account.')
    } finally {
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  if (isLoading || !company) return <CardSkeleton />

  return (
    <motion.div {...fadeIn} className="mx-auto max-w-3xl space-y-4">
      <Link to={`${basePath}/employers`} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-primary-700">
        <ArrowLeft className="h-4 w-4" /> Back to Employers
      </Link>

      <Card>
        <CardContent className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">{company.company_name || 'Unnamed Company'}</h1>
            <p className="text-sm text-slate-500">{company.email}</p>
            {(company.industry || company.business_permit_no) && (
              <p className="text-sm text-slate-500">{[company.industry, company.business_permit_no].filter(Boolean).join(' • ')}</p>
            )}
            <div className="mt-2">
              <StatusBadge status={company.accreditation_status} />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {company.accreditation_status === 'pending_review' && (
              <>
                <Button size="sm" onClick={() => setConfirmVerify(true)}>Approve Accreditation</Button>
                <Button size="sm" variant="secondary" onClick={() => setConfirmVerify(false)}>Reject Accreditation</Button>
              </>
            )}
            {company.accreditation_status === 'accredited' && (
              <Button size="sm" variant="danger" onClick={() => setConfirmSuspend(true)}>Suspend Account</Button>
            )}
            {company.accreditation_status === 'suspended' && role === 'admin' && (
              <Button size="sm" onClick={() => setConfirmReinstate(true)}>Reinstate Account</Button>
            )}
            {role === 'admin' && (
              <Button size="sm" variant="danger" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="h-3.5 w-3.5" /> Delete Permanently
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Documents</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {COMPANY_DOCUMENT_TYPES.map(({ type, label, required }) => {
            const doc = (company.documents || []).find((d) => d.document_type === type)
            return (
              <div key={type} className="flex items-center justify-between rounded-lg border border-slate-100 p-3">
                <div className="flex min-w-0 items-center gap-2">
                  <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">
                      {label} {required && <Badge variant="danger" className="ml-1">Required</Badge>}
                    </p>
                    {doc ? (
                      <a href={doc.file_url} target="_blank" rel="noreferrer" className="text-xs text-primary-700 hover:underline">
                        View file
                      </a>
                    ) : (
                      <p className="text-xs text-slate-400">Not submitted</p>
                    )}
                    {doc?.status === 'rejected' && doc.rejection_reason && (
                      <p className="text-xs text-red-600">Rejected: {doc.rejection_reason}</p>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {doc && <StatusBadge status={doc.status} />}
                  {doc && doc.status !== 'verified' && (
                    <button
                      title="Verify"
                      onClick={() => reviewDocument.mutate({ documentId: doc.id, status: 'verified' })}
                      className="text-green-600 hover:text-green-700"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </button>
                  )}
                  {doc && doc.status !== 'rejected' && (
                    <button
                      title="Reject"
                      onClick={() => setReviewingDoc({ id: doc.id, label })}
                      className="text-red-600 hover:text-red-700"
                    >
                      <XCircle className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vacancies Posted</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {!company.vacancies?.length ? (
            <p className="text-sm text-slate-400">No vacancies posted.</p>
          ) : (
            company.vacancies.map((v) => (
              <div key={v.id} className="flex items-center justify-between border-b border-slate-100 py-2 last:border-0">
                <span className="text-sm text-slate-700">{v.title}</span>
                <StatusBadge status={v.status} />
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Accreditation History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {!company.accreditation_history?.length ? (
            <p className="text-sm text-slate-400">No history yet.</p>
          ) : (
            company.accreditation_history.map((h) => (
              <div key={h.id} className="flex items-center justify-between border-b border-slate-100 py-2 text-sm last:border-0">
                <span className="text-slate-700">
                  <span className="font-medium">{h.action}</span> by {h.user_email || 'System'} {h.details ? `— ${h.details}` : ''}
                </span>
                <span className="shrink-0 text-xs text-slate-400">{new Date(h.created_at).toLocaleString()}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmVerify === true}
        onOpenChange={(open) => !open && setConfirmVerify(null)}
        title="Approve this employer's accreditation?"
        description="The employer will be accredited and can start posting job vacancies."
        confirmLabel="Approve"
        onConfirm={() => verify.mutate(true)}
        loading={verify.isPending}
      />

      <Dialog open={confirmVerify === false} onOpenChange={(open) => !open && setConfirmVerify(null)}>
        <DialogContent title="Reject this employer's accreditation?" description="Remarks are required so the employer knows what to fix.">
          <Label>Remarks</Label>
          <Textarea rows={3} value={rejectRemarks} onChange={(e) => setRejectRemarks(e.target.value)} placeholder="e.g. Business permit is expired." />
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setConfirmVerify(null)}>Cancel</Button>
            <Button variant="danger" size="sm" disabled={!rejectRemarks.trim() || verify.isPending} onClick={() => verify.mutate(false)}>
              {verify.isPending ? 'Please wait…' : 'Reject'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={reviewingDoc !== null} onOpenChange={(open) => !open && setReviewingDoc(null)}>
        <DialogContent title={`Reject ${reviewingDoc?.label}?`} description="A rejection reason is required so the employer knows what to fix.">
          <Label>Rejection Reason</Label>
          <Textarea rows={3} value={docRejectReason} onChange={(e) => setDocRejectReason(e.target.value)} placeholder="e.g. Document is blurry/unreadable." />
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setReviewingDoc(null)}>Cancel</Button>
            <Button
              variant="danger" size="sm" disabled={!docRejectReason.trim() || reviewDocument.isPending}
              onClick={() => reviewDocument.mutate({ documentId: reviewingDoc.id, status: 'rejected', rejection_reason: docRejectReason })}
            >
              {reviewDocument.isPending ? 'Please wait…' : 'Reject Document'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmSuspend}
        onOpenChange={setConfirmSuspend}
        title="Suspend this account?"
        description="The employer will immediately lose the ability to post or manage vacancies."
        confirmLabel="Suspend"
        danger
        onConfirm={() => suspend.mutate()}
        loading={suspend.isPending}
      />

      <ConfirmDialog
        open={confirmReinstate}
        onOpenChange={setConfirmReinstate}
        title="Reinstate this account?"
        description="The employer will be accredited again and can resume posting vacancies."
        confirmLabel="Reinstate"
        onConfirm={() => reinstate.mutate()}
        loading={reinstate.isPending}
      />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete Account"
        description="Are you sure you want to permanently delete this account? This action cannot be undone."
        confirmLabel="Delete Permanently"
        danger
        onConfirm={deleteAccount}
        loading={deleting}
      />
    </motion.div>
  )
}
