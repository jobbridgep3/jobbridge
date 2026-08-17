import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { motion } from 'framer-motion'
import { ArrowLeft, FileText, Send } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'

import { DilpNoShowBanner, DilpStepper } from '../../components/dilp/DilpStepper'
import { Button } from '../../components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { useConfirmDialog } from '../../components/ui/ConfirmDialog'
import { DatePicker } from '../../components/ui/DatePicker'
import { Dialog, DialogContent } from '../../components/ui/Dialog'
import { Input, Label } from '../../components/ui/Input'
import { PageHeader } from '../../components/ui/PageHeader'
import { CardSkeleton } from '../../components/ui/Skeleton'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { TimePicker } from '../../components/ui/TimePicker'
import { useSocket } from '../../hooks/useSocket'
import api from '../../lib/axios'
import { manila } from '../../lib/manilaTime'
import { fadeIn } from '../../lib/motion'

function to12h(time24) {
  return time24 ? dayjs(time24, 'HH:mm').format('h:mm A') : ''
}
function to24h(time12) {
  return time12 ? dayjs(time12, 'h:mm A').format('HH:mm') : ''
}

function StatusHistoryTimeline({ history = [] }) {
  if (!history.length) return <p className="text-xs text-text-muted">No history yet.</p>
  return (
    <div className="space-y-2">
      {[...history].reverse().map((h) => (
        <div key={h.id} className="rounded-lg border border-border-subtle p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-text-primary">
              {h.from_status ? <>{h.from_status.replace(/_/g, ' ')} → </> : null}
              <StatusBadge status={h.to_status} />
            </p>
            <p className="text-xs text-text-muted">{manila(h.created_at).format('MMM D, YYYY h:mm A')}</p>
          </div>
          <p className="mt-1 text-xs text-text-muted capitalize">by {h.changed_by_role}{h.note ? ` — ${h.note}` : ''}</p>
        </div>
      ))}
    </div>
  )
}

export default function StaffDILPDetail() {
  const { id } = useParams()
  const queryClient = useQueryClient()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [scheduleMode, setScheduleMode] = useState('schedule') // 'schedule' | 'reschedule'
  const [interviewDate, setInterviewDate] = useState('')
  const [interviewTime, setInterviewTime] = useState('')
  const [remarkText, setRemarkText] = useState('')

  const queryKey = ['staff', 'dilp', id]
  const { data: app, isLoading } = useQuery({
    queryKey,
    queryFn: async () => (await api.get(`/api/staff/dilp/${id}`)).data.data,
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey })
  useSocket({ 'dilp:board_update': invalidate })

  const runAction = useMutation({
    mutationFn: ({ action, body }) => api.put(`/api/staff/dilp/${id}/${action}`, body || {}),
    onSuccess: (_, { successMessage }) => {
      toast.success(successMessage)
      invalidate()
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Action failed.'),
  })

  const schedule = useMutation({
    mutationFn: () => api.put(`/api/staff/dilp/${id}/schedule`, { interview_date: interviewDate, interview_time: interviewTime }),
    onSuccess: () => {
      toast.success(scheduleMode === 'reschedule' ? 'Interview rescheduled.' : 'Interview scheduled.')
      setScheduleOpen(false)
      setInterviewDate('')
      setInterviewTime('')
      invalidate()
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not schedule interview.'),
  })

  const addRemark = useMutation({
    mutationFn: () => api.post(`/api/staff/dilp/${id}/remarks`, { remark: remarkText }),
    onSuccess: () => {
      toast.success('Remark added.')
      setRemarkText('')
      invalidate()
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not add remark.'),
  })

  if (isLoading || !app) return <CardSkeleton />

  const openSchedule = (mode) => {
    setScheduleMode(mode)
    setScheduleOpen(true)
  }

  const confirmTransition = (action, { title, description, successMessage }) =>
    confirm({
      title, description, confirmLabel: 'Confirm',
      onConfirm: () => runAction.mutateAsync({ action, successMessage }),
    })

  return (
    <motion.div {...fadeIn} className="space-y-4">
      <Link to="/staff/dilp" className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-text-primary">
        <ArrowLeft className="h-4 w-4" /> Back to DILP Applications
      </Link>

      <PageHeader title={app.jobseeker_name} description={app.proposed_livelihood} actions={<StatusBadge status={app.status} />} />

      <Card>
        <CardContent>
          <DilpStepper status={app.status} history={app.history} />
          {app.status === 'no_show' && (
            <DilpNoShowBanner>Applicant was marked absent for their scheduled interview{app.interview_at ? ` on ${manila(app.interview_at).format('MMMM D, YYYY [at] h:mm A')}` : ''}.</DilpNoShowBanner>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader><CardTitle>Applicant Information</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-sm">
              <div><p className="text-text-muted">Full Name</p><p className="text-text-primary">{app.jobseeker_name}</p></div>
              <div><p className="text-text-muted">Contact Number</p><p className="text-text-primary">{app.jobseeker_contact || '—'}</p></div>
              <div><p className="text-text-muted">Email</p><p className="text-text-primary">{app.jobseeker_email || '—'}</p></div>
              <div><p className="text-text-muted">Address</p><p className="text-text-primary">{app.jobseeker_address || '—'}</p></div>
              <div><p className="text-text-muted">Capital Needed</p><p className="text-text-primary">₱{Number(app.capital_needed).toLocaleString()}</p></div>
              <div className="sm:col-span-2"><p className="text-text-muted">Business Description / Justification</p><p className="text-text-primary">{app.business_description}</p></div>
              {app.interview_at && (
                <div className="sm:col-span-2"><p className="text-text-muted">Interview Date &amp; Time</p><p className="text-green-700">{manila(app.interview_at).format('MMMM D, YYYY [at] h:mm A')}</p></div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Uploaded Documents</CardTitle></CardHeader>
            <CardContent>
              {!app.documents?.length ? (
                <p className="text-xs text-text-muted">No documents uploaded.</p>
              ) : (
                <div className="space-y-1">
                  {app.documents.map((d) => (
                    <a key={d.id} href={d.file_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-sm text-primary-700 hover:underline">
                      <FileText className="h-3.5 w-3.5" /> {d.original_filename || 'View file'}
                    </a>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Status History / Timeline</CardTitle></CardHeader>
            <CardContent><StatusHistoryTimeline history={app.history} /></CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Internal Remarks</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {!app.remarks?.length ? (
                <p className="text-xs text-text-muted">No remarks yet. Internal notes are not shared as staff identity with the applicant.</p>
              ) : (
                <div className="space-y-2">
                  {app.remarks.map((r) => (
                    <div key={r.id} className="rounded-lg border border-border-subtle p-3">
                      <p className="text-sm text-text-primary">{r.remark}</p>
                      <p className="mt-1 text-xs text-text-muted">{r.staff_name} — {manila(r.created_at).format('MMM D, YYYY h:mm A')}</p>
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
              {app.status === 'pending' && (
                <Button onClick={() => openSchedule('schedule')}>Assign Interview Schedule</Button>
              )}
              {app.status === 'scheduled' && (
                <>
                  <Button onClick={() => confirmTransition('complete', {
                    title: 'Mark as Completed?',
                    description: 'Confirms the applicant attended their interview. The applicant will be emailed to proceed for finalization and the Mayor\'s signature.',
                    successMessage: 'Interview marked as completed.',
                  })}>
                    Mark as Completed
                  </Button>
                  <Button variant="danger" onClick={() => confirmTransition('no-show', {
                    title: 'Mark as No-Show?',
                    description: 'Confirms the applicant did not attend their scheduled interview. This can be rescheduled afterward.',
                    successMessage: 'Applicant marked as no-show.',
                  })}>
                    Mark as No-Show
                  </Button>
                </>
              )}
              {app.status === 'no_show' && (
                <Button onClick={() => openSchedule('reschedule')}>Reschedule Interview</Button>
              )}
              {app.status === 'completed' && (
                <Button onClick={() => confirmTransition('ready-for-claiming', {
                  title: 'Mark Ready for Claiming?',
                  description: 'Confirms the signed proposal has returned from the Mayor\'s office and is ready for the applicant to pick up at PESO. The applicant will be emailed.',
                  successMessage: 'Application marked ready for claiming.',
                })}>
                  Mark Ready for Claiming
                </Button>
              )}
              {app.status === 'ready_for_claiming' && (
                <Button onClick={() => confirmTransition('approve', {
                  title: 'Mark as Approved?',
                  description: 'Confirms the proposal has been officially approved (post-claiming). The applicant will be emailed.',
                  successMessage: 'Application marked as approved.',
                })}>
                  Mark as Approved
                </Button>
              )}
              {app.status === 'approved' && (
                <Button onClick={() => confirmTransition('submit-to-esfo', {
                  title: 'Mark as Submitted to ESFO?',
                  description: 'Confirms the approved proposal has been physically submitted to ESFO for funding. This is the final tracked status — the applicant will be emailed a final notice.',
                  successMessage: 'Application submitted to ESFO.',
                })}>
                  <Send className="h-4 w-4" /> Mark as Submitted to ESFO
                </Button>
              )}
              {app.status === 'submitted_to_esfo' && (
                <p className="text-xs text-text-muted">This application is closed — no further actions available.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {ConfirmDialogElement}

      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent title={scheduleMode === 'reschedule' ? 'Reschedule Interview' : 'Assign Interview Schedule'}>
          <div className="space-y-3">
            <p className="text-sm text-text-muted">Select the interview date and time (Asia/Manila). The applicant will be emailed this schedule.</p>
            <div>
              <Label>Interview Date</Label>
              <DatePicker value={interviewDate} onChange={setInterviewDate} />
            </div>
            <div>
              <Label>Interview Time</Label>
              <TimePicker value={to12h(interviewTime)} onChange={(t) => setInterviewTime(to24h(t))} />
            </div>
            <div className="flex justify-end">
              <Button onClick={() => schedule.mutate()} disabled={schedule.isPending || !interviewDate || !interviewTime}>
                {schedule.isPending ? 'Saving…' : 'Confirm Schedule'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
