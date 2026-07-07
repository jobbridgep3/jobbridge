import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ArrowLeft, FileText, ShieldCheck, ShieldX, UserRound } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { Link, useParams } from 'react-router-dom'

import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { Dialog, DialogContent } from '../../components/ui/Dialog'
import { Label, Textarea } from '../../components/ui/Input'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { CardSkeleton } from '../../components/ui/Skeleton'
import { StatusBadge } from '../../components/ui/StatusBadge'
import api from '../../lib/axios'
import { fadeIn } from '../../lib/motion'
import { DOCUMENT_TYPES } from '../jobseeker/profile-sections/options'

function row(label, value) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-sm text-slate-700">{value || '—'}</p>
    </div>
  )
}

export default function StaffJobseekerDetail({ basePath = '/staff' }) {
  const { id } = useParams()
  const queryClient = useQueryClient()
  const [rejectOpen, setRejectOpen] = useState(false)
  const [remarks, setRemarks] = useState('')
  const [ocrOpen, setOcrOpen] = useState(false)

  const { data: profile, isLoading } = useQuery({
    queryKey: ['staff', 'jobseekers', id],
    queryFn: async () => (await api.get(`/api/staff/jobseekers/${id}`)).data.data,
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['staff', 'jobseekers', id] })

  const verify = useMutation({
    mutationFn: (payload) => api.put(`/api/staff/jobseekers/${id}/verify`, payload),
    onSuccess: (res) => {
      toast.success(res.data.message)
      setRejectOpen(false)
      setRemarks('')
      invalidate()
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not update verification status.'),
  })

  const toggleActive = useMutation({
    mutationFn: () => api.put(`/api/staff/jobseekers/${id}/deactivate`),
    onSuccess: () => {
      toast.success('Account status updated.')
      invalidate()
    },
  })

  if (isLoading || !profile) return <CardSkeleton />

  const complete = profile.profile_completion >= 100
  const canVerify = complete && !profile.is_verified_by_staff

  return (
    <motion.div {...fadeIn} className="mx-auto max-w-4xl space-y-4">
      <Link to={`${basePath}/jobseekers`} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-primary-700">
        <ArrowLeft className="h-4 w-4" /> Back to Jobseekers
      </Link>

      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-slate-400">
                {profile.profile_picture_url ? (
                  <img src={profile.profile_picture_url} alt={profile.full_name} className="h-full w-full object-cover" />
                ) : (
                  <UserRound className="h-6 w-6" />
                )}
              </div>
              <div>
                <h1 className="text-lg font-semibold text-slate-900">{profile.full_name}</h1>
                <p className="text-sm text-slate-500">{profile.email}</p>
                <p className="text-sm text-slate-500">{profile.contact_number}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant={profile.is_verified_by_staff ? 'success' : 'default'}>
                    {profile.is_verified_by_staff ? 'Verified' : 'Unverified'}
                  </Badge>
                  {(profile.tags || []).map((t) => (
                    <Badge key={t} variant="primary">{t}</Badge>
                  ))}
                </div>
                {!profile.is_verified_by_staff && profile.verification_remarks && (
                  <p className="mt-2 max-w-md text-xs text-red-600">Not verified — reason: {profile.verification_remarks}</p>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Button size="sm" disabled={!canVerify} onClick={() => verify.mutate({ approve: true })}>
                <ShieldCheck className="h-3.5 w-3.5" /> Verify Account
              </Button>
              {!profile.is_verified_by_staff && (
                <Button size="sm" variant="danger" onClick={() => setRejectOpen(true)}>
                  <ShieldX className="h-3.5 w-3.5" /> Not Verified
                </Button>
              )}
              <Button size="sm" variant="secondary" onClick={() => toggleActive.mutate()}>
                Toggle Active Status
              </Button>
              {profile.resume_url && (
                <Button size="sm" variant="secondary" onClick={() => window.open(profile.resume_url, '_blank')}>
                  <FileText className="h-3.5 w-3.5" /> Resume
                </Button>
              )}
              {profile.resume_raw_text && (
                <Button size="sm" variant="ghost" onClick={() => setOcrOpen(true)}>
                  View OCR Text
                </Button>
              )}
            </div>
          </div>

          <ProgressBar percent={profile.profile_completion} />
          {!complete && (
            <p className="text-xs text-amber-600">Profile must be 100% complete to verify (currently {profile.profile_completion}%).</p>
          )}

          <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 sm:grid-cols-4">
            {row('Age', profile.age)}
            {row('Gender', profile.gender)}
            {row('Civil Status', profile.civil_status)}
            {row('Nationality', profile.nationality)}
            <div className="col-span-2 sm:col-span-4">{row('Address', profile.address)}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Employment Information</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {row('Employment Status', profile.employment_status)}
          {row('Preferred Job Position', profile.preferred_job_position)}
          {row('Preferred Industry', profile.preferred_industry)}
          {row('Preferred Work Location', profile.preferred_work_location)}
          {row('Expected Salary', profile.expected_salary)}
          {row('Employment Type', profile.employment_type)}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Educational Background</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {profile.educations?.length ? (
            profile.educations.map((e, i) => (
              <p key={i} className="text-sm text-slate-600">
                {e.attainment_level ? `${e.attainment_level} — ` : ''}{e.school}
                {e.degree ? `, ${e.degree}` : ''} {e.graduation_year ? `(${e.graduation_year})` : ''}
                {e.honors ? ` — ${e.honors}` : ''}
              </p>
            ))
          ) : (
            <p className="text-sm text-slate-400">No education records provided.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Skills</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            ['Technical Skills', profile.technical_skills],
            ['Soft Skills', profile.soft_skills],
            ['Languages Spoken', profile.languages_spoken],
            ['Certifications', profile.certifications],
          ].map(([label, values]) => (
            <div key={label}>
              <p className="mb-1 text-xs text-slate-400">{label}</p>
              <div className="flex flex-wrap gap-2">
                {values?.length ? values.map((s) => <Badge key={s}>{s}</Badge>) : <span className="text-sm text-slate-400">None</span>}
              </div>
            </div>
          ))}
          {profile.work_experiences?.map((w, i) => (
            <p key={i} className="text-sm text-slate-600">
              {w.position} — {w.company}
            </p>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Documents</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between border-b border-slate-100 py-2">
            <span className="text-sm text-slate-700">Resume/CV (Required)</span>
            {profile.resume_url ? (
              <a href={profile.resume_url} target="_blank" rel="noreferrer" className="text-sm text-primary-700 hover:underline">
                View
              </a>
            ) : (
              <Badge variant="danger">Missing</Badge>
            )}
          </div>
          {DOCUMENT_TYPES.map(({ type, label, required }) => {
            const docs = (profile.documents || []).filter((d) => d.document_type === type)
            return (
              <div key={type} className="flex items-center justify-between border-b border-slate-100 py-2 last:border-0">
                <span className="text-sm text-slate-700">{label}{required ? ' (Required)' : ''}</span>
                {docs.length ? (
                  <div className="flex gap-3">
                    {docs.map((d) => (
                      <a key={d.id} href={d.file_url} target="_blank" rel="noreferrer" className="text-sm text-primary-700 hover:underline">
                        View{docs.length > 1 ? ` (${d.original_filename || d.id.slice(0, 6)})` : ''}
                      </a>
                    ))}
                  </div>
                ) : (
                  <Badge variant={required ? 'danger' : 'default'}>{required ? 'Missing' : 'Not provided'}</Badge>
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Applications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {!profile.applications?.length ? (
            <p className="text-sm text-slate-400">No applications submitted.</p>
          ) : (
            profile.applications.map((a) => (
              <div key={a.id} className="flex items-center justify-between border-b border-slate-100 py-2 last:border-0">
                <span className="text-sm text-slate-700">{a.job_title} — {a.company_name}</span>
                <StatusBadge status={a.status} />
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent title="Mark as Not Verified" description="A reason is required so the jobseeker knows what to fix.">
          <Label>Reason</Label>
          <Textarea rows={4} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="e.g. Government ID is blurry, please re-upload." />
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={!remarks.trim() || verify.isPending}
              onClick={() => verify.mutate({ approve: false, remarks })}
            >
              {verify.isPending ? 'Submitting…' : 'Submit'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={ocrOpen} onOpenChange={setOcrOpen}>
        <DialogContent title="OCR-Extracted Resume Text" className="max-w-2xl">
          <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
            {profile.resume_raw_text}
          </pre>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
