import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import { motion } from 'framer-motion'
import { CalendarDays, List } from 'lucide-react'
import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'

import { Button } from '../../components/ui/Button'
import { CalendarView } from '../../components/ui/CalendarView'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { DataTable } from '../../components/ui/DataTable'
import { DatePicker } from '../../components/ui/DatePicker'
import { Dialog, DialogContent } from '../../components/ui/Dialog'
import { Input, Label, Select, Textarea } from '../../components/ui/Input'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { TimePicker } from '../../components/ui/TimePicker'
import { useSocket } from '../../hooks/useSocket'
import api from '../../lib/axios'
import { fadeIn } from '../../lib/motion'
import { cn } from '../../lib/utils'

dayjs.extend(customParseFormat)

const RESULT_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'passed', label: 'Passed' },
  { value: 'failed', label: 'Failed' },
  { value: 'shortlisted', label: 'Shortlisted' },
  { value: 'hired', label: 'Hired' },
]

function splitDT(iso) {
  if (!iso) return { date: '', time: '' }
  const d = dayjs(iso)
  return { date: d.format('YYYY-MM-DD'), time: d.format('HH:mm') }
}

/** editForm/suggestForm store time in 24h "HH:mm" (matching splitDT above and
 * the backend's datetime.fromisoformat contract) — these only convert for the
 * TimePicker's 12-hour "h:mm AM/PM" display/input format. */
function to12h(time24) {
  return time24 ? dayjs(time24, 'HH:mm').format('h:mm A') : ''
}
function to24h(time12) {
  return time12 ? dayjs(time12, 'h:mm A').format('HH:mm') : ''
}

export default function EmployerInterviews() {
  const queryClient = useQueryClient()
  const [viewMode, setViewMode] = useState('calendar') // calendar | table
  const [selected, setSelected] = useState(null)
  const [panel, setPanel] = useState('details') // details | edit | result | cancel
  const [cancelReason, setCancelReason] = useState('')
  const [editForm, setEditForm] = useState({})
  const [resultForm, setResultForm] = useState({ result: 'pending', score: '', notes: '' })
  const [suggestFor, setSuggestFor] = useState(null) // reschedule request being answered with a suggestion
  const [suggestForm, setSuggestForm] = useState({ date: '', time: '', note: '' })

  const { data: interviews, isLoading } = useQuery({
    queryKey: ['interviews', 'my'],
    queryFn: async () => (await api.get('/api/interviews/my')).data.data,
  })
  const { data: rescheduleRequests } = useQuery({
    queryKey: ['interviews', 'reschedule-requests'],
    queryFn: async () => (await api.get('/api/interviews/reschedule-requests/pending')).data.data,
  })

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['interviews', 'my'] })
    queryClient.invalidateQueries({ queryKey: ['interviews', 'reschedule-requests'] })
  }
  useSocket({
    'interview:accepted': refresh,
    'interview:declined': refresh,
    'interview:reschedule_request': refresh,
  })

  const closeDialog = () => {
    setSelected(null)
    setPanel('details')
    setCancelReason('')
  }

  const openEdit = (iv) => {
    const { date, time } = splitDT(iv.scheduled_date)
    setEditForm({
      date,
      time,
      mode: iv.mode,
      location: iv.location || '',
      meeting_link: iv.meeting_link || '',
      interviewer_name: iv.interviewer_name || '',
    })
    setPanel('edit')
  }

  const openResult = (iv) => {
    setResultForm({ result: iv.result || 'pending', score: iv.score ?? '', notes: iv.notes || '' })
    setPanel('result')
  }

  const updateInterview = useMutation({
    mutationFn: ({ id, payload }) => api.put(`/api/interviews/${id}`, payload),
    onSuccess: () => {
      toast.success('Interview updated — applicant notified of any new schedule.')
      refresh()
      closeDialog()
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not update interview.'),
  })

  const cancelInterview = useMutation({
    mutationFn: ({ id, reason }) => api.put(`/api/interviews/${id}/cancel`, { reason }),
    onSuccess: () => {
      toast.success('Interview cancelled — applicant notified.')
      refresh()
      closeDialog()
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not cancel interview.'),
  })

  const recordResult = useMutation({
    mutationFn: ({ id, payload }) => api.put(`/api/interviews/${id}/result`, payload),
    onSuccess: () => {
      toast.success('Result recorded.')
      refresh()
      closeDialog()
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not record result.'),
  })

  const respondRequest = useMutation({
    mutationFn: ({ id, payload }) => api.put(`/api/interviews/reschedule-requests/${id}`, payload),
    onSuccess: (_res, vars) => {
      toast.success(`Reschedule request ${vars.payload.action}d.`)
      refresh()
      setSuggestFor(null)
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not respond to request.'),
  })

  const events = useMemo(
    () =>
      (interviews || []).map((iv) => ({
        id: iv.id,
        date: iv.scheduled_date,
        title: iv.jobseeker_name || 'Interview',
        subtitle: iv.job_title,
        status: iv.status,
        meta: iv,
      })),
    [interviews],
  )

  const columns = [
    { accessorKey: 'jobseeker_name', header: 'Applicant' },
    { accessorKey: 'job_title', header: 'Position' },
    {
      accessorKey: 'scheduled_date',
      header: 'Date',
      cell: ({ row }) => dayjs(row.original.scheduled_date).format('MMM D, YYYY h:mm A'),
    },
    { accessorKey: 'mode', header: 'Mode' },
    { accessorKey: 'result', header: 'Result', cell: ({ row }) => <span className="capitalize">{row.original.result}</span> },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <Button size="sm" variant="secondary" onClick={() => setSelected(row.original)}>
          Manage
        </Button>
      ),
    },
  ]

  const editable = selected && !['cancelled', 'completed'].includes(selected.status)

  return (
    <motion.div {...fadeIn} className="space-y-4">
      <PageHeader
        title="Interview Management"
        description="Schedule, reschedule, cancel, and record results. Create invites from an applicant's detail page."
        actions={
          <div className="flex rounded-lg border border-slate-200 p-0.5">
            {[
              { key: 'calendar', icon: CalendarDays, label: 'Calendar' },
              { key: 'table', icon: List, label: 'Table' },
            ].map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => setViewMode(m.key)}
                className={cn(
                  'flex items-center gap-1 rounded-md px-3 py-1 text-xs font-medium',
                  viewMode === m.key ? 'bg-primary-800 text-white' : 'text-slate-600 hover:bg-slate-100',
                )}
              >
                <m.icon className="h-3.5 w-3.5" /> {m.label}
              </button>
            ))}
          </div>
        }
      />

      {rescheduleRequests?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Reschedule Requests ({rescheduleRequests.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {rescheduleRequests.map((req) => (
              <div key={req.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <div className="text-sm">
                  <p className="font-medium text-slate-900">
                    {req.interview?.jobseeker_name} — {req.interview?.job_title}
                  </p>
                  <p className="text-xs text-slate-600">
                    Current: {dayjs(req.interview?.scheduled_date).format('MMM D, h:mm A')} → Requested:{' '}
                    <b>{dayjs(req.preferred_date).format('MMM D, h:mm A')}</b>
                  </p>
                  {req.reason && <p className="text-xs italic text-slate-500">"{req.reason}"</p>}
                </div>
                {suggestFor === req.id ? (
                  <div className="flex flex-wrap items-end gap-2">
                    <div>
                      <Label>New Date</Label>
                      <DatePicker value={suggestForm.date} onChange={(date) => setSuggestForm({ ...suggestForm, date })} />
                    </div>
                    <div>
                      <Label>Time</Label>
                      <TimePicker value={to12h(suggestForm.time)} onChange={(t) => setSuggestForm({ ...suggestForm, time: to24h(t) })} />
                    </div>
                    <Button
                      size="sm"
                      disabled={!suggestForm.date || !suggestForm.time || respondRequest.isPending}
                      onClick={() =>
                        respondRequest.mutate({
                          id: req.id,
                          payload: { action: 'suggest', suggested_date: `${suggestForm.date}T${suggestForm.time}`, response_note: suggestForm.note },
                        })
                      }
                    >
                      Send
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setSuggestFor(null)}>
                      Back
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => respondRequest.mutate({ id: req.id, payload: { action: 'approve' } })} disabled={respondRequest.isPending}>
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setSuggestFor(req.id)
                        setSuggestForm({ date: '', time: '', note: '' })
                      }}
                    >
                      Suggest Another
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => respondRequest.mutate({ id: req.id, payload: { action: 'reject' } })} disabled={respondRequest.isPending}>
                      Reject
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {viewMode === 'calendar' ? (
        <CalendarView events={events} onEventClick={(e) => setSelected(e.meta)} />
      ) : (
        <DataTable
          columns={columns}
          data={interviews}
          isLoading={isLoading}
          searchPlaceholder="Search interviews…"
          emptyTitle="No interviews yet"
          emptyDescription="Schedule interviews from the Applicant Management page."
        />
      )}

      <Dialog open={!!selected} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent title="Manage Interview" className="max-w-lg">
          {selected && (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">{selected.jobseeker_name}</p>
                  <p className="text-sm text-slate-500">{selected.job_title}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {dayjs(selected.scheduled_date).format('MMM D, YYYY h:mm A')} · <span className="capitalize">{selected.mode}</span>
                    {selected.interviewer_name ? ` · ${selected.interviewer_name}` : ''}
                  </p>
                </div>
                <StatusBadge status={selected.status} />
              </div>

              {selected.status === 'declined' && selected.decline_reason && (
                <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                  <b>Declined:</b> {selected.decline_reason}
                </p>
              )}
              {selected.status === 'cancelled' && selected.cancel_reason && (
                <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                  <b>Cancellation reason:</b> {selected.cancel_reason}
                </p>
              )}
              {selected.result !== 'pending' && (
                <p className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                  <b>Result:</b> <span className="capitalize">{selected.result}</span>
                  {selected.score != null ? ` · Score: ${selected.score}/100` : ''}
                </p>
              )}
              {selected.notes && panel === 'details' && (
                <p className="text-sm text-slate-600">
                  <b>Notes:</b> {selected.notes}
                </p>
              )}

              {panel === 'edit' && (
                <div className="space-y-3 rounded-lg border border-slate-200 p-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Date</Label>
                      <DatePicker value={editForm.date} onChange={(date) => setEditForm({ ...editForm, date })} />
                    </div>
                    <div>
                      <Label>Time</Label>
                      <TimePicker value={to12h(editForm.time)} onChange={(t) => setEditForm({ ...editForm, time: to24h(t) })} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Mode</Label>
                      <Select value={editForm.mode} onChange={(e) => setEditForm({ ...editForm, mode: e.target.value })}>
                        <option value="onsite">Onsite</option>
                        <option value="online">Online</option>
                      </Select>
                    </div>
                    <div>
                      <Label>Interviewer</Label>
                      <Input
                        value={editForm.interviewer_name}
                        onChange={(e) => setEditForm({ ...editForm, interviewer_name: e.target.value })}
                        placeholder="Interviewer name"
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Venue</Label>
                    <Input value={editForm.location} onChange={(e) => setEditForm({ ...editForm, location: e.target.value })} placeholder="Office address" />
                  </div>
                  <div>
                    <Label>Meeting Link</Label>
                    <Input
                      value={editForm.meeting_link}
                      onChange={(e) => setEditForm({ ...editForm, meeting_link: e.target.value })}
                      placeholder="https://meet…"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setPanel('details')}>
                      Back
                    </Button>
                    <Button
                      size="sm"
                      disabled={!editForm.date || !editForm.time || updateInterview.isPending}
                      onClick={() =>
                        updateInterview.mutate({
                          id: selected.id,
                          payload: {
                            scheduled_date: `${editForm.date}T${editForm.time}`,
                            mode: editForm.mode,
                            location: editForm.location,
                            meeting_link: editForm.meeting_link,
                            interviewer_name: editForm.interviewer_name,
                          },
                        })
                      }
                    >
                      Save Changes
                    </Button>
                  </div>
                </div>
              )}

              {panel === 'result' && (
                <div className="space-y-3 rounded-lg border border-slate-200 p-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Result</Label>
                      <Select value={resultForm.result} onChange={(e) => setResultForm({ ...resultForm, result: e.target.value })}>
                        {RESULT_OPTIONS.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <Label>Score (0–100)</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={resultForm.score}
                        onChange={(e) => setResultForm({ ...resultForm, score: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Interview Notes (internal)</Label>
                    <Textarea value={resultForm.notes} onChange={(e) => setResultForm({ ...resultForm, notes: e.target.value })} />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setPanel('details')}>
                      Back
                    </Button>
                    <Button
                      size="sm"
                      disabled={recordResult.isPending}
                      onClick={() =>
                        recordResult.mutate({
                          id: selected.id,
                          payload: {
                            result: resultForm.result,
                            score: resultForm.score === '' ? null : Number(resultForm.score),
                            notes: resultForm.notes,
                          },
                        })
                      }
                    >
                      Save Result
                    </Button>
                  </div>
                </div>
              )}

              {panel === 'cancel' && (
                <div className="space-y-3 rounded-lg border border-slate-200 p-3">
                  <div>
                    <Label>Reason for cancelling</Label>
                    <Textarea
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      placeholder="Let the applicant know why this interview is being cancelled…"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setPanel('details')}>
                      Back
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={!cancelReason.trim() || cancelInterview.isPending}
                      onClick={() => cancelInterview.mutate({ id: selected.id, reason: cancelReason.trim() })}
                    >
                      Cancel Interview
                    </Button>
                  </div>
                </div>
              )}

              {panel === 'details' && (
                <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-3">
                  {editable && (
                    <>
                      <Button size="sm" variant="secondary" onClick={() => openEdit(selected)}>
                        Edit / Reschedule
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => openResult(selected)}>
                        Record Result
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setPanel('cancel')}>
                        Cancel Interview
                      </Button>
                    </>
                  )}
                  {selected.status === 'completed' && (
                    <Button size="sm" variant="secondary" onClick={() => openResult(selected)}>
                      Update Result
                    </Button>
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
