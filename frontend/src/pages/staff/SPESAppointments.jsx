import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { useState } from 'react'
import toast from 'react-hot-toast'

import { Button } from '../../components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { DatePicker } from '../../components/ui/DatePicker'
import { Dialog, DialogContent } from '../../components/ui/Dialog'
import { EmptyState } from '../../components/ui/EmptyState'
import { Label } from '../../components/ui/Input'
import { CardSkeleton } from '../../components/ui/Skeleton'
import { TimePicker } from '../../components/ui/TimePicker'
import { useSocket } from '../../hooks/useSocket'
import api from '../../lib/axios'
import { manila } from '../../lib/manilaTime'

function to12h(time24) {
  return time24 ? dayjs(time24, 'HH:mm').format('h:mm A') : ''
}
function to24h(time12) {
  return time12 ? dayjs(time12, 'h:mm A').format('HH:mm') : ''
}

function AppointmentDialog({ application, open, onOpenChange, onDone }) {
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')

  const save = useMutation({
    mutationFn: () => api.put(`/api/staff/spes/applications/${application.id}/peso-appointment`, { date, time }),
    onSuccess: () => {
      toast.success('PESO appointment saved — applicant notified by email.')
      setDate('')
      setTime('')
      onOpenChange(false)
      onDone()
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not save the appointment.'),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={`Set PESO Appointment — ${application?.full_name || ''}`} description="The applicant will be emailed the congratulations message plus this appointment.">
        <div className="space-y-3">
          <div>
            <Label>Date</Label>
            <DatePicker value={date} onChange={setDate} />
          </div>
          <div>
            <Label>Time</Label>
            <TimePicker value={to12h(time)} onChange={(t) => setTime(to24h(t))} />
          </div>
          <div className="flex justify-end">
            <Button onClick={() => save.mutate()} disabled={save.isPending || !date || !time}>
              {save.isPending ? 'Saving…' : 'Save & Notify'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function SPESAppointments() {
  const queryClient = useQueryClient()
  const [scheduling, setScheduling] = useState(null)

  const { data: passedApplications, isLoading } = useQuery({
    queryKey: ['staff', 'spes', 'applications', { status: 'passed' }],
    queryFn: async () => (await api.get('/api/staff/spes/applications', { params: { status: 'passed' } })).data.data,
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['staff', 'spes'] })
  useSocket({ 'spes:status_change': invalidate })

  const awaiting = (passedApplications || []).filter((a) => !a.peso_appointment_at)
  const scheduled = (passedApplications || []).filter((a) => a.peso_appointment_at)

  if (isLoading) return <CardSkeleton />

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-3 text-sm font-semibold text-text-primary">Awaiting PESO Appointment</h2>
        {!awaiting.length ? (
          <EmptyState title="No applicants awaiting an appointment" description="Applicants appear here once they pass the exam." />
        ) : (
          <div className="space-y-2">
            {awaiting.map((app) => (
              <Card key={app.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-text-primary">{app.full_name}</p>
                    <p className="text-xs text-text-muted">{app.batch_name}</p>
                  </div>
                  <Button size="sm" onClick={() => setScheduling(app)}>Set Appointment</Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-text-primary">Scheduled Appointments</h2>
        {!scheduled.length ? (
          <EmptyState title="No appointments scheduled yet" />
        ) : (
          <div className="space-y-2">
            {scheduled.map((app) => (
              <Card key={app.id}>
                <CardHeader><CardTitle>{app.full_name}</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-sm text-text-secondary">{app.batch_name}</p>
                  <p className="text-xs text-text-muted">PESO Office — {manila(app.peso_appointment_at).format('MMMM D, YYYY [at] h:mm A')}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <AppointmentDialog application={scheduling} open={Boolean(scheduling)} onOpenChange={(o) => !o && setScheduling(null)} onDone={invalidate} />
    </div>
  )
}
