import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import { motion } from 'framer-motion'
import { ArrowLeft, Download, FileText, Send } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { Link, useParams } from 'react-router-dom'

import { ApplicationTimeline } from '../../components/application/ApplicationTimeline'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { DatePicker } from '../../components/ui/DatePicker'
import { Dialog, DialogContent } from '../../components/ui/Dialog'
import { Input, Label, Select, Textarea } from '../../components/ui/Input'
import { CardSkeleton } from '../../components/ui/Skeleton'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { TimePicker } from '../../components/ui/TimePicker'
import { useSocket } from '../../hooks/useSocket'
import api from '../../lib/axios'
import { fadeIn } from '../../lib/motion'
import { cn } from '../../lib/utils'

dayjs.extend(customParseFormat)

/** Splits/joins a datetime-local string ("yyyy-mm-ddThh:mm", 24-hour — the
 * format the backend stores/parses) into its date ("yyyy-mm-dd") part and a
 * time part in TimePicker's 12-hour "h:mm AM/PM" display format. */
function splitScheduledDate(value) {
  const [date = '', time24 = ''] = (value || '').split('T')
  const time = time24 ? dayjs(time24, 'HH:mm').format('h:mm A') : ''
  return { date, time }
}
function joinScheduledDate(date, time) {
  if (!date) return ''
  const time24 = time ? dayjs(time, 'h:mm A').format('HH:mm') : '00:00'
  return `${date}T${time24}`
}

/* Mirrors the backend transition map (services/application_status_service.py) so we
 * only show actions the API will accept from the current status. */
const EMPLOYER_ACTIONS_BY_STATUS = {
  applied: ['under_review', 'shortlisted', 'hired', 'rejected'],
  under_review: ['shortlisted', 'background_verification', 'hired', 'rejected'],
  shortlisted: ['under_review', 'background_verification', 'hired', 'rejected'],
  interview_scheduled: ['background_verification', 'hired', 'rejected'],
  interview_completed: ['shortlisted', 'background_verification', 'hired', 'rejected'],
  background_verification: ['hired', 'rejected'],
  offer_extended: ['hired', 'rejected'],
}

const ACTION_LABELS = {
  under_review: 'Mark Under Review',
  shortlisted: 'Shortlist',
  background_verification: 'Background Verification',
  hired: 'Mark Hired',
  rejected: 'Reject',
}

const CAN_INVITE_INTERVIEW = ['applied', 'under_review', 'shortlisted', 'interview_scheduled', 'interview_completed']
const CAN_OFFER = ['under_review', 'shortlisted', 'interview_scheduled', 'interview_completed', 'background_verification']

const TABS = ['Profile', 'Documents', 'Timeline', 'Messages', 'Offer']

function MessagesTab({ applicationId }) {
  const queryClient = useQueryClient()
  const [body, setBody] = useState('')
  const { data: messages, isLoading } = useQuery({
    queryKey: ['applications', applicationId, 'messages'],
    queryFn: async () => (await api.get(`/api/applications/${applicationId}/messages`)).data.data,
  })
  useSocket({
    'application:message': () => queryClient.invalidateQueries({ queryKey: ['applications', applicationId, 'messages'] }),
  })
  const send = useMutation({
    mutationFn: () => api.post(`/api/applications/${applicationId}/messages`, { body: body.trim() }),
    onSuccess: () => {
      setBody('')
      queryClient.invalidateQueries({ queryKey: ['applications', applicationId, 'messages'] })
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not send message.'),
  })

  return (
    <div className="space-y-3">
      <div className="max-h-80 space-y-2 overflow-y-auto rounded-lg bg-slate-50 p-3">
        {isLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : !messages?.length ? (
          <p className="py-6 text-center text-sm text-slate-500">No messages yet — start the conversation below.</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={cn('flex', m.sender_role === 'employer' ? 'justify-end' : 'justify-start')}>
              <div
                className={cn(
                  'max-w-[75%] rounded-xl px-3 py-2 text-sm',
                  m.sender_role === 'employer' ? 'bg-primary-800 text-white' : 'border border-slate-200 bg-white text-slate-800',
                )}
              >
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p className={cn('mt-1 text-[10px]', m.sender_role === 'employer' ? 'text-primary-200' : 'text-slate-400')}>
                  {dayjs(m.created_at).format('MMM D, h:mm A')}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
      <div className="flex gap-2">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write a message to the applicant…"
          className="min-h-[44px] flex-1"
        />
        <Button onClick={() => send.mutate()} disabled={!body.trim() || send.isPending}>
          <Send className="h-4 w-4" /> Send
        </Button>
      </div>
    </div>
  )
}

export default function EmployerApplicantDetail() {
  const { id } = useParams()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState('Profile')
  const [interviewOpen, setInterviewOpen] = useState(false)
  const [interviewForm, setInterviewForm] = useState({
    scheduled_date: '',
    mode: 'onsite',
    location: '',
    meeting_link: '',
    interviewer_name: '',
  })
  const [docRequestOpen, setDocRequestOpen] = useState(false)
  const [docRequestForm, setDocRequestForm] = useState({ document_label: '', note: '' })
  const [offerOpen, setOfferOpen] = useState(false)
  const [offerForm, setOfferForm] = useState({ position: '', salary_offer: '', employment_type: '', start_date: '', terms: '' })

  const { data: applicant, isLoading } = useQuery({
    queryKey: ['applicants', id],
    queryFn: async () => (await api.get(`/api/applicants/${id}`)).data.data,
  })

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['applicants', id] })
  useSocket({
    'application:document_request': refresh,
    'offer:response': refresh,
  })

  const updateStatus = useMutation({
    mutationFn: (status) => api.put(`/api/applicants/${id}/status`, { status }),
    onSuccess: () => {
      toast.success('Status updated — applicant notified.')
      refresh()
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not update status.'),
  })

  const scheduleInterview = useMutation({
    mutationFn: () => api.post('/api/interviews', { application_id: id, ...interviewForm }),
    onSuccess: () => {
      toast.success('Interview scheduled — jobseeker notified.')
      setInterviewOpen(false)
      refresh()
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not schedule interview.'),
  })

  const requestDocument = useMutation({
    mutationFn: () => api.post(`/api/applications/${id}/document-requests`, docRequestForm),
    onSuccess: () => {
      toast.success('Document request sent — applicant notified.')
      setDocRequestOpen(false)
      setDocRequestForm({ document_label: '', note: '' })
      refresh()
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not send request.'),
  })

  const sendOffer = useMutation({
    mutationFn: () =>
      api.post(`/api/applications/${id}/offer`, {
        ...offerForm,
        salary_offer: offerForm.salary_offer === '' ? null : Number(offerForm.salary_offer),
        start_date: offerForm.start_date || null,
      }),
    onSuccess: () => {
      toast.success('Job offer sent — applicant notified.')
      setOfferOpen(false)
      refresh()
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not send offer.'),
  })

  const withdrawOffer = useMutation({
    mutationFn: (offerId) => api.put(`/api/offers/${offerId}/withdraw`),
    onSuccess: () => {
      toast.success('Offer withdrawn.')
      refresh()
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not withdraw offer.'),
  })

  if (isLoading || !applicant) return <CardSkeleton />

  const profile = applicant.jobseeker_profile
  const offer = applicant.job_offer

  return (
    <motion.div {...fadeIn} className="mx-auto max-w-3xl space-y-4">
      <Link to="/employer/applicants" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-primary-700">
        <ArrowLeft className="h-4 w-4" /> Back to Applicants
      </Link>

      <Card>
        <CardContent className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">{profile.full_name}</h1>
            <p className="text-sm text-slate-500">
              Applied for {applicant.job_title} · {applicant.reference_no} · {dayjs(applicant.created_at).format('MMM D, YYYY')}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusBadge status={applicant.status} label={applicant.status_label} />
              <Badge variant="primary">{applicant.match_score}% AI Match</Badge>
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {(EMPLOYER_ACTIONS_BY_STATUS[applicant.status] || []).map((status) => (
            <Button
              key={status}
              size="sm"
              variant={status === 'rejected' ? 'ghost' : status === 'hired' ? 'primary' : 'secondary'}
              onClick={() => updateStatus.mutate(status)}
              disabled={updateStatus.isPending}
            >
              {ACTION_LABELS[status]}
            </Button>
          ))}
          {CAN_INVITE_INTERVIEW.includes(applicant.status) && (
            <Button size="sm" variant="secondary" onClick={() => setInterviewOpen(true)}>
              <Send className="h-3.5 w-3.5" /> Send Interview Invite
            </Button>
          )}
          {CAN_OFFER.includes(applicant.status) && (!offer || offer.status === 'withdrawn') && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setOfferForm({ position: applicant.job_title || '', salary_offer: '', employment_type: '', start_date: '', terms: '' })
                setOfferOpen(true)
              }}
            >
              Generate Job Offer
            </Button>
          )}
          <Button size="sm" variant="secondary" onClick={() => setDocRequestOpen(true)}>
            Request Documents
          </Button>
          {!(EMPLOYER_ACTIONS_BY_STATUS[applicant.status] || []).length && (
            <p className="text-sm text-slate-500">
              This application is {applicant.status === 'hired' ? 'hired' : applicant.status === 'cancelled' ? 'withdrawn' : 'closed'} — no further
              actions available.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-white p-1">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              'rounded-md px-4 py-1.5 text-sm font-medium',
              tab === t ? 'bg-primary-800 text-white' : 'text-slate-600 hover:bg-slate-100',
            )}
          >
            {t}
            {t === 'Offer' && offer && <span className="ml-1 text-xs opacity-70">({offer.status})</span>}
          </button>
        ))}
      </div>

      {tab === 'Profile' && (
        <Card>
          <CardContent className="space-y-4">
            <div>
              <h4 className="mb-2 text-sm font-semibold text-slate-900">Skills</h4>
              <div className="flex flex-wrap gap-2">
                {[...(profile.technical_skills || []), ...(profile.soft_skills || [])].map((s) => (
                  <Badge key={s}>{s}</Badge>
                ))}
                {!(profile.technical_skills?.length || profile.soft_skills?.length) && (
                  <p className="text-sm text-slate-500">No skills listed.</p>
                )}
              </div>
            </div>
            <div>
              <h4 className="mb-2 text-sm font-semibold text-slate-900">Work Experience</h4>
              {profile.work_experiences?.length ? (
                profile.work_experiences.map((w, i) => (
                  <p key={i} className="text-sm text-slate-600">
                    {w.position} — {w.company}
                    {w.start_date ? ` (${dayjs(w.start_date).format('YYYY')}${w.end_date ? `–${dayjs(w.end_date).format('YYYY')}` : '–present'})` : ''}
                  </p>
                ))
              ) : (
                <p className="text-sm text-slate-500">No work experience listed.</p>
              )}
            </div>
            <div>
              <h4 className="mb-2 text-sm font-semibold text-slate-900">Education</h4>
              {profile.educations?.length ? (
                profile.educations.map((e, i) => (
                  <p key={i} className="text-sm text-slate-600">
                    {e.attainment_level ? `${e.attainment_level} — ` : ''}
                    {e.degree ? `${e.degree}, ` : ''}
                    {e.school}
                    {e.graduation_year ? ` (${e.graduation_year})` : ''}
                  </p>
                ))
              ) : (
                <p className="text-sm text-slate-500">No education listed.</p>
              )}
            </div>
            <div>
              <h4 className="mb-2 text-sm font-semibold text-slate-900">Certifications</h4>
              <div className="flex flex-wrap gap-2">
                {profile.certifications?.length ? (
                  profile.certifications.map((c) => <Badge key={c}>{c}</Badge>)
                ) : (
                  <p className="text-sm text-slate-500">No certifications listed.</p>
                )}
              </div>
            </div>
            <div className="text-sm text-slate-600">
              <h4 className="mb-1 text-sm font-semibold text-slate-900">Location</h4>
              {[profile.barangay, profile.municipality, profile.province].filter(Boolean).join(', ') || 'Not provided'}
            </div>
          </CardContent>
        </Card>
      )}

      {tab === 'Documents' && (
        <Card>
          <CardContent className="space-y-4">
            {applicant.referral_letter?.pdf_url && (
              <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-sm font-medium text-emerald-900">PESO Referral Letter</p>
                <Button size="sm" variant="secondary" onClick={() => window.open(applicant.referral_letter.pdf_url, '_blank')}>
                  <Download className="h-3.5 w-3.5" /> View
                </Button>
              </div>
            )}
            <div>
              <h4 className="mb-2 text-sm font-semibold text-slate-900">Uploaded Documents</h4>
              {profile.documents?.length ? (
                <div className="space-y-2">
                  {profile.documents.map((d) => (
                    <div key={d.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                      <div>
                        <p className="text-sm font-medium capitalize text-slate-800">{d.document_type.replace(/_/g, ' ')}</p>
                        <p className="text-xs text-slate-500">{d.original_filename}</p>
                      </div>
                      <Button size="sm" variant="secondary" onClick={() => window.open(d.file_url, '_blank')}>
                        <Download className="h-3.5 w-3.5" /> View
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">No documents uploaded.</p>
              )}
            </div>
            <div>
              <h4 className="mb-2 text-sm font-semibold text-slate-900">Document Requests</h4>
              {applicant.document_requests?.length ? (
                <div className="space-y-2">
                  {applicant.document_requests.map((r) => (
                    <div key={r.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                      <div>
                        <p className="text-sm font-medium text-slate-800">{r.document_label}</p>
                        <p className="text-xs text-slate-500">
                          Requested {dayjs(r.created_at).format('MMM D, YYYY')}
                          {r.note ? ` · ${r.note}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={r.status} />
                        {r.submitted_document && (
                          <Button size="sm" variant="secondary" onClick={() => window.open(r.submitted_document.file_url, '_blank')}>
                            <Download className="h-3.5 w-3.5" /> View
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">No additional documents requested yet.</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {tab === 'Timeline' && (
        <Card>
          <CardContent>
            <ApplicationTimeline events={applicant.timeline} />
          </CardContent>
        </Card>
      )}

      {tab === 'Messages' && (
        <Card>
          <CardContent>
            <MessagesTab applicationId={id} />
          </CardContent>
        </Card>
      )}

      {tab === 'Offer' && (
        <Card>
          <CardContent>
            {offer ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-slate-900">Job Offer — {offer.position}</h4>
                  <StatusBadge status={offer.status} label={offer.status === 'offered' ? 'Awaiting Response' : undefined} />
                </div>
                <div className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-4 text-sm">
                  <div>
                    <p className="text-xs text-slate-500">Salary Offer</p>
                    <p className="font-medium">{offer.salary_offer != null ? `PHP ${Number(offer.salary_offer).toLocaleString()}` : 'As discussed'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Employment Type</p>
                    <p className="font-medium capitalize">{offer.employment_type?.replace(/_/g, ' ') || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Start Date</p>
                    <p className="font-medium">{offer.start_date ? dayjs(offer.start_date).format('MMM D, YYYY') : 'To be arranged'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Sent</p>
                    <p className="font-medium">{dayjs(offer.created_at).format('MMM D, YYYY')}</p>
                  </div>
                </div>
                {offer.terms && <p className="text-sm text-slate-600">{offer.terms}</p>}
                <div className="flex justify-end gap-2">
                  {offer.pdf_url && (
                    <Button size="sm" variant="secondary" onClick={() => window.open(offer.pdf_url, '_blank')}>
                      <Download className="h-3.5 w-3.5" /> Offer Letter
                    </Button>
                  )}
                  {offer.status === 'offered' && (
                    <Button size="sm" variant="ghost" onClick={() => withdrawOffer.mutate(offer.id)} disabled={withdrawOffer.isPending}>
                      Withdraw Offer
                    </Button>
                  )}
                  {offer.status === 'accepted' && applicant.status !== 'hired' && (
                    <Button size="sm" onClick={() => updateStatus.mutate('hired')} disabled={updateStatus.isPending}>
                      Mark Hired
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <p className="py-6 text-center text-sm text-slate-500">
                No job offer yet — use "Generate Job Offer" above when you're ready to make an offer.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={interviewOpen} onOpenChange={setInterviewOpen}>
        <DialogContent title="Schedule Interview">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Date</Label>
                <DatePicker
                  value={splitScheduledDate(interviewForm.scheduled_date).date}
                  onChange={(date) =>
                    setInterviewForm({
                      ...interviewForm,
                      scheduled_date: joinScheduledDate(date, splitScheduledDate(interviewForm.scheduled_date).time),
                    })
                  }
                  minDate={new Date().toISOString().slice(0, 10)}
                />
              </div>
              <div>
                <Label>Time</Label>
                <TimePicker
                  value={splitScheduledDate(interviewForm.scheduled_date).time}
                  onChange={(time) =>
                    setInterviewForm({
                      ...interviewForm,
                      scheduled_date: joinScheduledDate(splitScheduledDate(interviewForm.scheduled_date).date, time),
                    })
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Mode</Label>
                <Select value={interviewForm.mode} onChange={(e) => setInterviewForm({ ...interviewForm, mode: e.target.value })}>
                  <option value="onsite">Onsite</option>
                  <option value="online">Online</option>
                </Select>
              </div>
              <div>
                <Label>Interviewer</Label>
                <Input
                  value={interviewForm.interviewer_name}
                  onChange={(e) => setInterviewForm({ ...interviewForm, interviewer_name: e.target.value })}
                  placeholder="Interviewer name"
                />
              </div>
            </div>
            {interviewForm.mode === 'online' ? (
              <div>
                <Label>Meeting Link</Label>
                <Input
                  value={interviewForm.meeting_link}
                  onChange={(e) => setInterviewForm({ ...interviewForm, meeting_link: e.target.value })}
                  placeholder="https://meet…"
                />
              </div>
            ) : (
              <div>
                <Label>Venue</Label>
                <Textarea value={interviewForm.location} onChange={(e) => setInterviewForm({ ...interviewForm, location: e.target.value })} />
              </div>
            )}
            <div className="flex justify-end">
              <Button onClick={() => scheduleInterview.mutate()} disabled={scheduleInterview.isPending}>
                {scheduleInterview.isPending ? 'Scheduling…' : 'Send Invite'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={docRequestOpen} onOpenChange={setDocRequestOpen}>
        <DialogContent title="Request Additional Document">
          <div className="space-y-4">
            <div>
              <Label>Document Needed</Label>
              <Input
                value={docRequestForm.document_label}
                onChange={(e) => setDocRequestForm({ ...docRequestForm, document_label: e.target.value })}
                placeholder="e.g. NBI Clearance, Transcript of Records"
              />
            </div>
            <div>
              <Label>Note (optional)</Label>
              <Textarea
                value={docRequestForm.note}
                onChange={(e) => setDocRequestForm({ ...docRequestForm, note: e.target.value })}
                placeholder="Any specifics about the document…"
              />
            </div>
            <div className="flex justify-end">
              <Button onClick={() => requestDocument.mutate()} disabled={!docRequestForm.document_label.trim() || requestDocument.isPending}>
                Send Request
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={offerOpen} onOpenChange={setOfferOpen}>
        <DialogContent title="Generate Job Offer">
          <div className="space-y-4">
            <div>
              <Label>Position</Label>
              <Input value={offerForm.position} onChange={(e) => setOfferForm({ ...offerForm, position: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Monthly Salary (PHP)</Label>
                <Input
                  type="number"
                  min="0"
                  value={offerForm.salary_offer}
                  onChange={(e) => setOfferForm({ ...offerForm, salary_offer: e.target.value })}
                  placeholder="e.g. 18000"
                />
              </div>
              <div>
                <Label>Employment Type</Label>
                <Select value={offerForm.employment_type} onChange={(e) => setOfferForm({ ...offerForm, employment_type: e.target.value })}>
                  <option value="">Select…</option>
                  <option value="full_time">Full-time</option>
                  <option value="part_time">Part-time</option>
                  <option value="contract">Contract</option>
                  <option value="probationary">Probationary</option>
                  <option value="project_based">Project-based</option>
                </Select>
              </div>
            </div>
            <div>
              <Label>Expected Start Date</Label>
              <DatePicker
                value={offerForm.start_date}
                onChange={(date) => setOfferForm({ ...offerForm, start_date: date })}
                minDate={new Date().toISOString().slice(0, 10)}
              />
            </div>
            <div>
              <Label>Additional Terms (optional)</Label>
              <Textarea value={offerForm.terms} onChange={(e) => setOfferForm({ ...offerForm, terms: e.target.value })} />
            </div>
            <div className="flex justify-end">
              <Button onClick={() => sendOffer.mutate()} disabled={!offerForm.position.trim() || sendOffer.isPending}>
                {sendOffer.isPending ? 'Sending…' : 'Send Offer'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
