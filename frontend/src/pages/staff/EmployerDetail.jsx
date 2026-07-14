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
import { ProgressBar } from '../../components/ui/ProgressBar'
import { CardSkeleton } from '../../components/ui/Skeleton'
import { StatusBadge } from '../../components/ui/StatusBadge'
import api from '../../lib/axios'
import { fadeIn } from '../../lib/motion'
import { useAuthStore } from '../../store/authStore'
import { COMPANY_DOCUMENT_TYPES } from '../employer/company-sections/options'
import { HR_DOCUMENT_TYPES } from '../employer/hr-sections/options'

/** Read-only "label: value" row — used throughout the Company/HR Profile detail cards below. */
function InfoRow({ label, value }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-400">{label}</p>
      <p className="text-sm text-slate-800">{value || value === 0 ? value : '—'}</p>
    </div>
  )
}

function formatAddress(entity) {
  return [entity.street_address, entity.barangay_name, entity.city_municipality_name, entity.province_name, entity.region_name, entity.zip_code]
    .filter(Boolean)
    .join(', ') || '—'
}

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
  const [reviewingHrDoc, setReviewingHrDoc] = useState(null) // { id, label } | null
  const [hrDocRejectReason, setHrDocRejectReason] = useState('')

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

  const reviewHrDocument = useMutation({
    mutationFn: ({ documentId, status, rejection_reason }) =>
      api.put(`/api/staff/employers/${id}/hr-documents/${documentId}/review`, { status, rejection_reason }),
    onSuccess: () => {
      toast.success('Document review updated.')
      setReviewingHrDoc(null)
      setHrDocRejectReason('')
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
          <CardTitle>Company Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ProgressBar percent={company.profile_completion || 0} label={`Profile Completion (${company.completed_count ?? 0}/${company.total_count ?? 0} fields)`} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <InfoRow label="Trade Name" value={company.trade_name} />
            <InfoRow label="Business Type" value={company.business_type?.replace(/_/g, ' ')} />
            <InfoRow label="Nature of Business" value={company.nature_of_business} />
            <InfoRow label="Company Size" value={company.company_size} />
            <InfoRow label="Year Established" value={company.year_established} />
            <InfoRow label="Number of Employees" value={company.num_employees} />
            <InfoRow label="Website" value={company.website} />
            <InfoRow label="Contact Number" value={company.contact_number} />
            <InfoRow label="Alt. Contact Number" value={company.alt_contact_number} />
            <InfoRow label="BIR TIN" value={company.bir_tin} />
            <InfoRow label="SEC Registration No." value={company.sec_number} />
            <InfoRow label="DTI Registration No." value={company.dti_number} />
            <InfoRow label="CDA Registration No." value={company.cda_number} />
            <InfoRow label="Hiring Status" value={company.hiring_status?.replace(/_/g, ' ')} />
            <InfoRow label="Company Created" value={company.created_at && new Date(company.created_at).toLocaleDateString()} />
            <InfoRow label="Last Updated" value={company.updated_at && new Date(company.updated_at).toLocaleDateString()} />
            <div className="sm:col-span-2 lg:col-span-3">
              <InfoRow label="Complete Address" value={formatAddress(company)} />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <InfoRow label="Company Description" value={company.description} />
            </div>
          </div>
          <div className="border-t border-slate-100 pt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Company Representative</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <InfoRow label="Full Name" value={company.rep_name} />
              <InfoRow label="Position" value={company.rep_position} />
              <InfoRow label="Email" value={company.rep_email} />
              <InfoRow label="Contact Number" value={company.rep_contact_number} />
              <InfoRow label="Government ID No." value={company.rep_gov_id_number} />
              <div>
                <p className="text-xs font-medium text-slate-400">Digital Signature</p>
                {company.rep_signature_url ? (
                  <a href={company.rep_signature_url} target="_blank" rel="noreferrer" className="text-sm text-primary-700 hover:underline">
                    View signature
                  </a>
                ) : (
                  <p className="text-sm text-slate-800">—</p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>HR Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!company.hr_profile ? (
            <p className="text-sm text-slate-400">This employer has not filled out their personal HR profile yet.</p>
          ) : (
            <>
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-50">
                  {company.hr_profile.profile_picture_url ? (
                    <img src={company.hr_profile.profile_picture_url} alt="Profile" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-xs text-slate-400">No photo</span>
                  )}
                </div>
                <ProgressBar
                  className="flex-1"
                  percent={company.hr_profile.profile_completion || 0}
                  label={`Profile Completion (${company.hr_profile.completed_count ?? 0}/${company.hr_profile.total_count ?? 0} fields)`}
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <InfoRow label="Full Name" value={company.hr_profile.full_name} />
                <InfoRow label="Position" value={company.hr_profile.position} />
                <InfoRow label="Department" value={company.hr_profile.department} />
                <InfoRow label="Employment Status" value={company.hr_profile.employment_status} />
                <InfoRow label="Gender" value={company.hr_profile.gender} />
                <InfoRow label="Date of Birth" value={company.hr_profile.date_of_birth} />
                <InfoRow label="Civil Status" value={company.hr_profile.civil_status} />
                <InfoRow label="Nationality" value={company.hr_profile.nationality} />
                <InfoRow label="Company Email" value={company.email} />
                <InfoRow label="Personal Email" value={company.hr_profile.personal_email} />
                <InfoRow label="Mobile Number" value={company.hr_profile.mobile_number} />
                <InfoRow label="Telephone Number" value={company.hr_profile.telephone_number} />
                <div className="sm:col-span-2 lg:col-span-3">
                  <InfoRow label="Complete Address" value={formatAddress(company.hr_profile)} />
                </div>
              </div>
              <div className="border-t border-slate-100 pt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Emergency Contact</p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <InfoRow label="Name" value={company.hr_profile.emergency_contact_name} />
                  <InfoRow label="Relationship" value={company.hr_profile.emergency_contact_relationship} />
                  <InfoRow label="Contact Number" value={company.hr_profile.emergency_contact_number} />
                </div>
              </div>
              <div className="border-t border-slate-100 pt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">HR Documents</p>
                <div className="space-y-2">
                  {HR_DOCUMENT_TYPES.map(({ type, label, required }) => {
                    const doc = (company.hr_profile.documents || []).find((d) => d.document_type === type)
                    return (
                      <div key={type} className="flex items-center justify-between rounded-lg border border-slate-100 p-3">
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
                        <div className="flex shrink-0 items-center gap-2">
                          {doc && <StatusBadge status={doc.status} />}
                          {doc && doc.status !== 'verified' && (
                            <button
                              title="Verify"
                              onClick={() => reviewHrDocument.mutate({ documentId: doc.id, status: 'verified' })}
                              className="text-green-600 hover:text-green-700"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </button>
                          )}
                          {doc && doc.status !== 'rejected' && (
                            <button
                              title="Reject"
                              onClick={() => setReviewingHrDoc({ id: doc.id, label })}
                              className="text-red-600 hover:text-red-700"
                            >
                              <XCircle className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          )}
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

      <Dialog open={reviewingHrDoc !== null} onOpenChange={(open) => !open && setReviewingHrDoc(null)}>
        <DialogContent title={`Reject ${reviewingHrDoc?.label}?`} description="A rejection reason is required so the employer knows what to fix.">
          <Label>Rejection Reason</Label>
          <Textarea rows={3} value={hrDocRejectReason} onChange={(e) => setHrDocRejectReason(e.target.value)} placeholder="e.g. Document is blurry/unreadable." />
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setReviewingHrDoc(null)}>Cancel</Button>
            <Button
              variant="danger" size="sm" disabled={!hrDocRejectReason.trim() || reviewHrDocument.isPending}
              onClick={() => reviewHrDocument.mutate({ documentId: reviewingHrDoc.id, status: 'rejected', rejection_reason: hrDocRejectReason })}
            >
              {reviewHrDocument.isPending ? 'Please wait…' : 'Reject Document'}
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
