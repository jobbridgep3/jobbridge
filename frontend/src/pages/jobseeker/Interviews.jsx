import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import { motion } from 'framer-motion'
import { Building2, CalendarCheck, Clock, Download, Link2, MapPin, User } from 'lucide-react'
import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'

import { Button } from '../../components/ui/Button'
import { CalendarView } from '../../components/ui/CalendarView'
import { DatePicker } from '../../components/ui/DatePicker'
import { Dialog, DialogContent } from '../../components/ui/Dialog'
import { EmptyState } from '../../components/ui/EmptyState'
import { Label, Textarea } from '../../components/ui/Input'
import { PageHeader } from '../../components/ui/PageHeader'
import { CardSkeleton } from '../../components/ui/Skeleton'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { TimePicker } from '../../components/ui/TimePicker'
import { useSocket } from '../../hooks/useSocket'
import api from '../../lib/axios'
import { downloadFile, parseBlobError } from '../../lib/download'
import { fadeIn } from '../../lib/motion'

dayjs.extend(customParseFormat)

const RESULT_LABELS = { passed: 'Passed', failed: 'Failed', shortlisted: 'Shortlisted', hired: 'Hired' }

/** reschedule.time is stored as 24h "HH:mm" (matching the backend's
 * datetime.fromisoformat contract) — these only convert for the TimePicker's
 * 12-hour "h:mm AM/PM" display/input format. */
function to12h(time24) {
  return time24 ? dayjs(time24, 'HH:mm').format('h:mm A') : ''
}
function to24h(time12) {
  return time12 ? dayjs(time12, 'h:mm A').format('HH:mm') : ''
}

function DetailRow({ icon: Icon, label, children }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <div className="font-medium text-slate-800">{children}</div>
      </div>
    </div>
  )
}

export default function JobseekerInterviews() {
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState(null) // interview object
  const [panel, setPanel] = useState('details') // details | decline | reschedule
  const [declineReason, setDeclineReason] = useState('')
  const [reschedule, setReschedule] = useState({ date: '', time: '', reason: '' })
  const [downloading, setDownloading] = useState(false)

  const { data: interviews, isLoading } = useQuery({
    queryKey: ['interviews', 'my'],
    queryFn: async () => (await api.get('/api/interviews/my')).data.data,
  })

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['interviews', 'my'] })
  useSocket({
    'interview:scheduled': refresh,
    'interview:rescheduled': refresh,
    'interview:cancelled': refresh,
    'interview:reschedule_response': refresh,
    'interview:result': refresh,
  })

  const closeDialog = () => {
    setSelected(null)
    setPanel('details')
    setDeclineReason('')
    setReschedule({ date: '', time: '', reason: '' })
  }

  const accept = useMutation({
    mutationFn: (id) => api.put(`/api/interviews/${id}/accept`),
    onSuccess: () => {
      toast.success('Interview accepted — employer notified.')
      refresh()
      closeDialog()
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not accept interview.'),
  })

  const decline = useMutation({
    mutationFn: ({ id, reason }) => api.put(`/api/interviews/${id}/decline`, { reason }),
    onSuccess: () => {
      toast.success('Interview declined — employer notified.')
      refresh()
      closeDialog()
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not decline interview.'),
  })

  const requestReschedule = useMutation({
    mutationFn: ({ id, preferred_date, reason }) => api.post(`/api/interviews/${id}/reschedule-requests`, { preferred_date, reason }),
    onSuccess: () => {
      toast.success('Reschedule request sent to the employer.')
      refresh()
      closeDialog()
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not send request.'),
  })

  const downloadInvitation = async (id) => {
    setDownloading(true)
    try {
      await downloadFile(`/api/interviews/${id}/invitation/pdf`, { filename: 'interview-invitation.pdf' })
    } catch (err) {
      toast.error(await parseBlobError(err))
    } finally {
      setDownloading(false)
    }
  }

  const events = useMemo(
    () =>
      (interviews || []).map((iv) => ({
        id: iv.id,
        date: iv.scheduled_date,
        title: iv.job_title || 'Interview',
        subtitle: iv.company_name,
        status: iv.status,
        meta: iv,
      })),
    [interviews],
  )

  const canRespond = selected && ['pending', 'rescheduled'].includes(selected.status)
  const canReschedule = selected && !['cancelled', 'completed', 'declined'].includes(selected.status)

  return (
    <motion.div {...fadeIn} className="space-y-4">
      <PageHeader
        title="Interview Schedule"
        description="Your interview calendar — accept, decline, or request a reschedule, and download invitations."
      />

      {isLoading ? (
        <CardSkeleton />
      ) : !interviews?.length ? (
        <EmptyState icon={CalendarCheck} title="No interviews yet" description="Interview invitations from employers will appear here." />
      ) : (
        <CalendarView events={events} onEventClick={(e) => setSelected(e.meta)} />
      )}

      <Dialog open={!!selected} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent title="Interview Details" className="max-w-lg">
          {selected && (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">{selected.job_title}</p>
                  <p className="text-sm text-slate-500">{selected.company_name}</p>
                </div>
                <StatusBadge status={selected.status} />
              </div>

              <div className="grid grid-cols-1 gap-3 rounded-lg bg-slate-50 p-4 sm:grid-cols-2">
                <DetailRow icon={Clock} label="Date & Time">
                  {dayjs(selected.scheduled_date).format('MMM D, YYYY h:mm A')}
                </DetailRow>
                <DetailRow icon={Building2} label="Interview Type">
                  <span className="capitalize">{selected.mode}</span>
                </DetailRow>
                <DetailRow icon={User} label="Interviewer">
                  {selected.interviewer_name || 'To be announced'}
                </DetailRow>
                {selected.location && (
                  <DetailRow icon={MapPin} label="Venue">
                    {selected.location}
                  </DetailRow>
                )}
                {selected.meeting_link && (
                  <DetailRow icon={Link2} label="Meeting Link">
                    <a href={selected.meeting_link} target="_blank" rel="noreferrer" className="break-all text-primary-700 hover:underline">
                      {selected.meeting_link}
                    </a>
                  </DetailRow>
                )}
              </div>

              {selected.result && selected.result !== 'pending' && (
                <p className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                  <b>Interview result:</b> {RESULT_LABELS[selected.result] || selected.result}
                </p>
              )}
              {selected.pending_reschedule_request && (
                <p className="rounded-lg border border-violet-200 bg-violet-50 p-3 text-sm text-violet-900">
                  <b>Reschedule requested:</b> {dayjs(selected.pending_reschedule_request.preferred_date).format('MMM D, YYYY h:mm A')} — waiting
                  for the employer's response.
                </p>
              )}
              {selected.status === 'declined' && selected.decline_reason && (
                <p className="text-sm text-slate-500">
                  <b>Decline reason:</b> {selected.decline_reason}
                </p>
              )}
              {selected.status === 'cancelled' && selected.cancel_reason && (
                <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                  <b>Cancelled by employer:</b> {selected.cancel_reason}
                </p>
              )}

              {panel === 'decline' && (
                <div className="space-y-3 rounded-lg border border-slate-200 p-3">
                  <div>
                    <Label>Reason for declining</Label>
                    <Textarea value={declineReason} onChange={(e) => setDeclineReason(e.target.value)} placeholder="Let the employer know why…" />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setPanel('details')}>
                      Back
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={!declineReason.trim() || decline.isPending}
                      onClick={() => decline.mutate({ id: selected.id, reason: declineReason.trim() })}
                    >
                      Decline Interview
                    </Button>
                  </div>
                </div>
              )}

              {panel === 'reschedule' && (
                <div className="space-y-3 rounded-lg border border-slate-200 p-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Preferred Date</Label>
                      <DatePicker
                        value={reschedule.date}
                        onChange={(date) => setReschedule({ ...reschedule, date })}
                        minDate={new Date().toISOString().slice(0, 10)}
                      />
                    </div>
                    <div>
                      <Label>Preferred Time</Label>
                      <TimePicker value={to12h(reschedule.time)} onChange={(t) => setReschedule({ ...reschedule, time: to24h(t) })} />
                    </div>
                  </div>
                  <div>
                    <Label>Reason</Label>
                    <Textarea
                      value={reschedule.reason}
                      onChange={(e) => setReschedule({ ...reschedule, reason: e.target.value })}
                      placeholder="Why do you need a new schedule?"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setPanel('details')}>
                      Back
                    </Button>
                    <Button
                      size="sm"
                      disabled={!reschedule.date || !reschedule.time || requestReschedule.isPending}
                      onClick={() =>
                        requestReschedule.mutate({
                          id: selected.id,
                          preferred_date: `${reschedule.date}T${reschedule.time}`,
                          reason: reschedule.reason.trim() || undefined,
                        })
                      }
                    >
                      Send Request
                    </Button>
                  </div>
                </div>
              )}

              {panel === 'details' && (
                <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-3">
                  <Button size="sm" variant="secondary" onClick={() => downloadInvitation(selected.id)} disabled={downloading}>
                    <Download className="h-3.5 w-3.5" /> Invitation
                  </Button>
                  {canReschedule && !selected.pending_reschedule_request && (
                    <Button size="sm" variant="secondary" onClick={() => setPanel('reschedule')}>
                      Request Reschedule
                    </Button>
                  )}
                  {canRespond && (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => setPanel('decline')}>
                        Decline
                      </Button>
                      <Button size="sm" onClick={() => accept.mutate(selected.id)} disabled={accept.isPending}>
                        Accept Interview
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
