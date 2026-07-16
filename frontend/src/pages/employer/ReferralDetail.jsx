import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { motion } from 'framer-motion'
import { ArrowLeft, Calendar, Check, Download, FileText, X } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { Link, useParams } from 'react-router-dom'

import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card, CardContent } from '../../components/ui/Card'
import { Dialog, DialogContent } from '../../components/ui/Dialog'
import { Label, Textarea } from '../../components/ui/Input'
import { CardSkeleton } from '../../components/ui/Skeleton'
import { StatusBadge } from '../../components/ui/StatusBadge'
import api from '../../lib/axios'
import { fadeIn } from '../../lib/motion'

export default function EmployerReferralDetail() {
  const { id } = useParams()
  const queryClient = useQueryClient()
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  const { data: referral, isLoading } = useQuery({
    queryKey: ['employer', 'referrals', id],
    queryFn: async () => (await api.get(`/api/employer/referrals/${id}`)).data.data,
  })

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['employer', 'referrals', id] })

  const accept = useMutation({
    mutationFn: () => api.put(`/api/employer/referrals/${id}/accept`),
    onSuccess: () => {
      toast.success('Referral accepted — applicant added to your pipeline.')
      refresh()
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not accept referral.'),
  })

  const reject = useMutation({
    mutationFn: (reason) => api.put(`/api/employer/referrals/${id}/reject`, { reason }),
    onSuccess: () => {
      toast.success('Referral rejected — jobseeker notified.')
      setRejectOpen(false)
      setRejectReason('')
      refresh()
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not reject referral.'),
  })

  if (isLoading || !referral) return <CardSkeleton />

  const profile = referral.jobseeker_profile
  const isPending = referral.employer_status === 'pending'

  return (
    <motion.div {...fadeIn} className="mx-auto max-w-3xl space-y-4">
      <Link to="/employer/referrals" className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-primary-700">
        <ArrowLeft className="h-4 w-4" /> Back to Referrals
      </Link>

      <Card>
        <CardContent className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-lg font-semibold text-text-primary">{profile.full_name}</h1>
              <p className="text-sm text-text-muted">
                Referred for {referral.job_title} · {referral.referral_number || 'No. pending'} · {dayjs(referral.created_at).format('MMM D, YYYY')}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <StatusBadge status={referral.employer_status} />
                {referral.match_score != null && <Badge variant="primary">{referral.match_score}% AI Match</Badge>}
                <Badge variant={profile.is_verified_by_staff ? 'success' : 'default'}>
                  {profile.is_verified_by_staff ? 'PESO Verified' : 'Unverified'}
                </Badge>
              </div>
            </div>
            {profile.resume_url && (
              <Button variant="secondary" size="sm" onClick={() => window.open(profile.resume_url, '_blank')}>
                <FileText className="h-3.5 w-3.5" /> View Resume
              </Button>
            )}
          </div>
          {referral.reason && (
            <p className="rounded-lg bg-surface-secondary p-3 text-sm text-text-secondary">
              <span className="font-medium text-text-primary">Jobseeker's reason: </span>
              {referral.reason}
            </p>
          )}
          {!isPending && referral.employer_status === 'rejected' && referral.employer_rejection_reason && (
            <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
              <span className="font-medium">Rejection reason: </span>
              {referral.employer_rejection_reason}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-wrap gap-2">
          {isPending && (
            <>
              <Button size="sm" onClick={() => accept.mutate()} disabled={accept.isPending}>
                <Check className="h-3.5 w-3.5" /> {accept.isPending ? 'Accepting…' : 'Accept Referral'}
              </Button>
              <Button size="sm" variant="danger" onClick={() => setRejectOpen(true)}>
                <X className="h-3.5 w-3.5" /> Reject Referral
              </Button>
            </>
          )}
          {referral.employer_status === 'accepted' && referral.application_id && (
            <Button size="sm" variant="secondary" asChild>
              <Link to={`/employer/applicants/${referral.application_id}`}>
                <Calendar className="h-3.5 w-3.5" /> Schedule Interview
              </Link>
            </Button>
          )}
          {referral.pdf_url && (
            <Button size="sm" variant="secondary" onClick={() => window.open(referral.pdf_url, '_blank')}>
              <Download className="h-3.5 w-3.5" /> Download Referral Letter
            </Button>
          )}
          {!isPending && !referral.application_id && (
            <p className="text-sm text-text-muted">This referral has been reviewed — no further action available.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4">
          <div>
            <h4 className="mb-2 text-sm font-semibold text-text-primary">Skills</h4>
            <div className="flex flex-wrap gap-2">
              {[...(profile.technical_skills || []), ...(profile.soft_skills || [])].map((s) => (
                <Badge key={s}>{s}</Badge>
              ))}
              {!(profile.technical_skills?.length || profile.soft_skills?.length) && (
                <p className="text-sm text-text-muted">No skills listed.</p>
              )}
            </div>
          </div>
          <div>
            <h4 className="mb-2 text-sm font-semibold text-text-primary">Work Experience</h4>
            {profile.work_experiences?.length ? (
              profile.work_experiences.map((w, i) => (
                <p key={i} className="text-sm text-text-secondary">
                  {w.position} — {w.company}
                  {w.start_date ? ` (${dayjs(w.start_date).format('YYYY')}${w.end_date ? `–${dayjs(w.end_date).format('YYYY')}` : '–present'})` : ''}
                </p>
              ))
            ) : (
              <p className="text-sm text-text-muted">No work experience listed.</p>
            )}
          </div>
          <div>
            <h4 className="mb-2 text-sm font-semibold text-text-primary">Education</h4>
            {profile.educations?.length ? (
              profile.educations.map((e, i) => (
                <p key={i} className="text-sm text-text-secondary">
                  {e.attainment_level ? `${e.attainment_level} — ` : ''}
                  {e.degree ? `${e.degree}, ` : ''}
                  {e.school}
                  {e.graduation_year ? ` (${e.graduation_year})` : ''}
                </p>
              ))
            ) : (
              <p className="text-sm text-text-muted">No education listed.</p>
            )}
          </div>
          <div>
            <h4 className="mb-2 text-sm font-semibold text-text-primary">Certifications</h4>
            <div className="flex flex-wrap gap-2">
              {profile.certifications?.length ? (
                profile.certifications.map((c) => <Badge key={c}>{c}</Badge>)
              ) : (
                <p className="text-sm text-text-muted">No certifications listed.</p>
              )}
            </div>
          </div>
          <div className="text-sm text-text-secondary">
            <h4 className="mb-1 text-sm font-semibold text-text-primary">Location</h4>
            {[profile.barangay, profile.municipality, profile.province].filter(Boolean).join(', ') || 'Not provided'}
          </div>
          <div>
            <h4 className="mb-2 text-sm font-semibold text-text-primary">Uploaded Documents</h4>
            {profile.documents?.length ? (
              <div className="space-y-2">
                {profile.documents.map((d) => (
                  <div key={d.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                    <div>
                      <p className="text-sm font-medium capitalize text-text-primary">{d.document_type.replace(/_/g, ' ')}</p>
                      <p className="text-xs text-text-muted">{d.original_filename}</p>
                    </div>
                    <Button size="sm" variant="secondary" onClick={() => window.open(d.file_url, '_blank')}>
                      <Download className="h-3.5 w-3.5" /> View
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-text-muted">No documents uploaded.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent title="Reject Referral">
          <div className="space-y-4">
            <p className="text-sm text-text-secondary">
              Rejecting <b>{profile.full_name}</b>'s referral for <b>{referral.job_title}</b>. The jobseeker will be notified with your reason.
            </p>
            <div>
              <Label>Reason</Label>
              <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Why isn't this candidate a fit right now?" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setRejectOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                disabled={!rejectReason.trim() || reject.isPending}
                onClick={() => reject.mutate(rejectReason.trim())}
              >
                {reject.isPending ? 'Rejecting…' : 'Reject Referral'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
