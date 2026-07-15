import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ArrowLeft, FileText, Send } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { ApplicationTimeline } from '../../components/application/ApplicationTimeline'

import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { DatePicker } from '../../components/ui/DatePicker'
import { Dialog, DialogContent } from '../../components/ui/Dialog'
import { Input, Label, Select, Textarea } from '../../components/ui/Input'
import { CardSkeleton } from '../../components/ui/Skeleton'
import { StatusBadge } from '../../components/ui/StatusBadge'
import api from '../../lib/axios'
import { fadeIn } from '../../lib/motion'

/** Splits/joins a datetime-local string ("yyyy-mm-ddThh:mm") into its date
 * ("yyyy-mm-dd") and time ("hh:mm") parts for the DatePicker + time Input pair. */
function splitScheduledDate(value) {
  const [date = '', time = ''] = (value || '').split('T')
  return { date, time }
}
function joinScheduledDate(date, time) {
  if (!date) return ''
  return `${date}T${time || '00:00'}`
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

export default function EmployerApplicantDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [interviewOpen, setInterviewOpen] = useState(false)
  const [interviewForm, setInterviewForm] = useState({
    scheduled_date: '',
    mode: 'onsite',
    location: '',
    meeting_link: '',
    interviewer_name: '',
  })

  const { data: applicant, isLoading } = useQuery({
    queryKey: ['applicants', id],
    queryFn: async () => (await api.get(`/api/applicants/${id}`)).data.data,
  })

  const updateStatus = useMutation({
    mutationFn: (status) => api.put(`/api/applicants/${id}/status`, { status }),
    onSuccess: () => {
      toast.success('Status updated — applicant notified.')
      queryClient.invalidateQueries({ queryKey: ['applicants', id] })
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not update status.'),
  })

  const scheduleInterview = useMutation({
    mutationFn: () => api.post('/api/interviews', { application_id: id, ...interviewForm }),
    onSuccess: () => {
      toast.success('Interview scheduled — jobseeker notified.')
      setInterviewOpen(false)
      queryClient.invalidateQueries({ queryKey: ['applicants', id] })
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not schedule interview.'),
  })

  const requestReferral = async () => {
    await api.post(`/api/applicants/${id}/referral-request`)
    toast.success('Referral letter requested from PESO Staff.')
  }

  if (isLoading || !applicant) return <CardSkeleton />

  const profile = applicant.jobseeker_profile

  return (
    <motion.div {...fadeIn} className="mx-auto max-w-3xl space-y-4">
      <Link to="/employer/applicants" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-primary-700">
        <ArrowLeft className="h-4 w-4" /> Back to Applicants
      </Link>

      <Card>
        <CardContent className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">{profile.full_name}</h1>
            <p className="text-sm text-slate-500">Applied for {applicant.job_title}</p>
            <div className="mt-2 flex items-center gap-2">
              <StatusBadge status={applicant.status} />
              <Badge variant="primary">{applicant.match_score}% AI Match</Badge>
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
          <CardTitle>Skills & Background</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {[...(profile.technical_skills || []), ...(profile.soft_skills || [])].map((s) => (
              <Badge key={s}>{s}</Badge>
            ))}
          </div>
          {profile.work_experiences?.map((w, i) => (
            <p key={i} className="text-sm text-slate-600">
              {w.position} — {w.company}
            </p>
          ))}
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
          <Button size="sm" variant="secondary" onClick={requestReferral}>
            Request Referral Letter
          </Button>
          {!(EMPLOYER_ACTIONS_BY_STATUS[applicant.status] || []).length && (
            <p className="text-sm text-slate-500">
              This application is {applicant.status === 'hired' ? 'hired' : applicant.status === 'cancelled' ? 'withdrawn' : 'closed'} — no further
              actions available.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Application Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <ApplicationTimeline events={applicant.timeline} />
        </CardContent>
      </Card>

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
                <Input
                  type="time"
                  value={splitScheduledDate(interviewForm.scheduled_date).time}
                  onChange={(e) =>
                    setInterviewForm({
                      ...interviewForm,
                      scheduled_date: joinScheduledDate(splitScheduledDate(interviewForm.scheduled_date).date, e.target.value),
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
    </motion.div>
  )
}
