import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { useState } from 'react'
import toast from 'react-hot-toast'

import { DressCodeEditor } from '../../components/spes/DressCodeEditor'
import { Button } from '../../components/ui/Button'
import { Card, CardContent } from '../../components/ui/Card'
import { useConfirmDialog } from '../../components/ui/ConfirmDialog'
import { DatePicker } from '../../components/ui/DatePicker'
import { EmptyState } from '../../components/ui/EmptyState'
import { Input, Label, Select } from '../../components/ui/Input'
import { TimePicker } from '../../components/ui/TimePicker'
import { useSocket } from '../../hooks/useSocket'
import api from '../../lib/axios'
import { cn } from '../../lib/utils'

function to12h(time24) {
  return time24 ? dayjs(time24, 'HH:mm').format('h:mm A') : ''
}
function to24h(time12) {
  return time12 ? dayjs(time12, 'h:mm A').format('HH:mm') : ''
}

function ScheduleForm({ batch, event, onSaved }) {
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const prefix = event // 'orientation' | 'exam'
  const [date, setDate] = useState(batch[`${prefix}_at`] ? dayjs(batch[`${prefix}_at`]).format('YYYY-MM-DD') : '')
  const [time, setTime] = useState(batch[`${prefix}_at`] ? dayjs(batch[`${prefix}_at`]).format('HH:mm') : '')
  const [venue, setVenue] = useState(batch[`${prefix}_venue`] || '')
  const [dressCode, setDressCode] = useState(batch[`${prefix}_dress_code`] || { top: [], bottom: [], footwear: [] })

  const { data: recipientCount } = useQuery({
    queryKey: ['staff', 'spes', 'batches', batch.id, `${prefix}-schedule`, 'recipient-count'],
    queryFn: async () => (await api.get(`/api/staff/spes/batches/${batch.id}/${prefix}-schedule/recipient-count`)).data.data.count,
  })

  const save = useMutation({
    mutationFn: () => api.put(`/api/staff/spes/batches/${batch.id}/${prefix}-schedule`, { date, time, venue, dress_code: dressCode }),
    onSuccess: (res) => {
      toast.success(res.data.message)
      onSaved()
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not save the schedule.'),
  })

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label>Date</Label>
          <DatePicker value={date} onChange={setDate} />
        </div>
        <div>
          <Label>Time</Label>
          <TimePicker value={to12h(time)} onChange={(t) => setTime(to24h(t))} />
        </div>
      </div>
      <div>
        <Label>Venue</Label>
        <Input value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="e.g. PESO Pila Multi-Purpose Hall" />
      </div>
      <div>
        <Label>Dress Code</Label>
        <DressCodeEditor value={dressCode} onChange={setDressCode} />
      </div>
      <div className="flex justify-end">
        <Button
          onClick={() =>
            confirm({
              title: `Save ${event === 'orientation' ? 'Orientation' : 'Exam'} Schedule?`,
              description: `This will notify ${recipientCount ?? 0} applicant(s) by email — Send?`,
              confirmLabel: 'Save & Notify',
              onConfirm: () => save.mutateAsync(),
            })
          }
          disabled={save.isPending || !date || !time || !venue.trim()}
        >
          {save.isPending ? 'Saving…' : 'Save & Send Notice'}
        </Button>
      </div>
      {ConfirmDialogElement}
    </div>
  )
}

export function SPESBatchSchedule({ batches }) {
  const queryClient = useQueryClient()
  const [batchId, setBatchId] = useState('')
  const [event, setEvent] = useState('orientation')

  const batch = (batches || []).find((b) => b.id === batchId)

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['staff', 'spes'] })
  useSocket({ 'spes:status_change': invalidate })

  return (
    <div className="space-y-4">
      <Card>
        <CardContent>
          <Label>Batch</Label>
          <Select value={batchId} onChange={(e) => setBatchId(e.target.value)}>
            <option value="">Select a batch…</option>
            {(batches || []).map((b) => (
              <option key={b.id} value={b.id}>{b.batch_name}</option>
            ))}
          </Select>
        </CardContent>
      </Card>

      {!batch ? (
        <EmptyState title="Select a batch" description="Choose a batch above to set its orientation and exam schedule." />
      ) : (
        <>
          <div className="flex w-fit rounded-lg border border-border bg-surface p-0.5">
            {[
              { key: 'orientation', label: 'Orientation / Interview' },
              { key: 'exam', label: 'Exam' },
            ].map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setEvent(t.key)}
                className={cn('rounded-md px-4 py-1.5 text-sm font-medium', event === t.key ? 'bg-primary-800 text-white' : 'text-text-secondary hover:bg-surface-hover')}
              >
                {t.label}
              </button>
            ))}
          </div>
          <Card>
            <CardContent>
              <ScheduleForm key={`${batch.id}-${event}`} batch={batch} event={event} onSaved={invalidate} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
