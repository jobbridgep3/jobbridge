import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ArrowLeft, FileText, Send } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { Link, useNavigate, useParams } from 'react-router-dom'

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

export default function EmployerApplicantDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [interviewOpen, setInterviewOpen] = useState(false)
  const [interviewForm, setInterviewForm] = useState({ scheduled_date: '', mode: 'onsite', location: '' })

  const { data: applicant, isLoading } = useQuery({
    queryKey: ['applicants', id],
    queryFn: async () => (await api.get(`/api/applicants/${id}`)).data.data,
  })

  const updateStatus = useMutation({
    mutationFn: (status) => api.put(`/api/applicants/${id}/status`, { status }),
    onSuccess: () => {
      toast.success('Status updated.')
      queryClient.invalidateQueries({ queryKey: ['applicants', id] })
    },
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
          <Button size="sm" onClick={() => updateStatus.mutate('under_review')} disabled={applicant.status === 'under_review'}>
            Mark Under Review
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setInterviewOpen(true)}>
            <Send className="h-3.5 w-3.5" /> Send Interview Invite
          </Button>
          <Button size="sm" variant="secondary" onClick={() => updateStatus.mutate('hired')}>
            Mark Hired
          </Button>
          <Button size="sm" variant="ghost" onClick={() => updateStatus.mutate('rejected')}>
            Reject
          </Button>
          <Button size="sm" variant="secondary" onClick={requestReferral}>
            Request Referral Letter
          </Button>
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
            <div>
              <Label>Mode</Label>
              <Select value={interviewForm.mode} onChange={(e) => setInterviewForm({ ...interviewForm, mode: e.target.value })}>
                <option value="onsite">Onsite</option>
                <option value="online">Online</option>
              </Select>
            </div>
            <div>
              <Label>Location / Meeting Link</Label>
              <Textarea value={interviewForm.location} onChange={(e) => setInterviewForm({ ...interviewForm, location: e.target.value })} />
            </div>
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
