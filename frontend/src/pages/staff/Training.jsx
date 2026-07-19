import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import { motion } from 'framer-motion'
import { Award, Download, Plus } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'

import { Button } from '../../components/ui/Button'
import { Card, CardContent } from '../../components/ui/Card'
import { DatePicker } from '../../components/ui/DatePicker'
import { Dialog, DialogContent } from '../../components/ui/Dialog'
import { EmptyState } from '../../components/ui/EmptyState'
import { Input, Label, Textarea } from '../../components/ui/Input'
import { PageHeader } from '../../components/ui/PageHeader'
import { CardSkeleton } from '../../components/ui/Skeleton'
import { TimePicker } from '../../components/ui/TimePicker'
import api from '../../lib/axios'
import { downloadFile, parseBlobError } from '../../lib/download'
import { fadeIn, staggerContainer, staggerItem } from '../../lib/motion'

dayjs.extend(customParseFormat)

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

export default function StaffTraining() {
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', trainer: '', venue: '', schedule: '', max_slots: 30 })

  const exportReport = async () => {
    setExporting(true)
    try {
      await downloadFile('/api/staff/training/report', { filename: 'training_report.xlsx' })
    } catch (err) {
      toast.error(await parseBlobError(err))
    } finally {
      setExporting(false)
    }
  }

  const { data: programs, isLoading } = useQuery({
    queryKey: ['training'],
    queryFn: async () => (await api.get('/api/training')).data.data,
  })

  const createMutation = useMutation({
    mutationFn: () => api.post('/api/staff/training', form),
    onSuccess: () => {
      toast.success('Training program created.')
      setCreateOpen(false)
      queryClient.invalidateQueries({ queryKey: ['training'] })
    },
  })

  return (
    <motion.div {...fadeIn} className="space-y-4">
      <PageHeader
        title="ManPower Skills Management"
        description="Create and manage PESO skills training programs."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> Create Program
          </Button>
        }
      />

      {isLoading ? (
        <CardSkeleton />
      ) : !programs?.length ? (
        <EmptyState icon={Award} title="No training programs yet" />
      ) : (
        <motion.div variants={staggerContainer} initial="initial" animate="animate" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {programs.map((p) => (
            <motion.div key={p.id} variants={staggerItem}>
              <Card>
                <CardContent>
                  <h3 className="text-sm font-semibold text-slate-900">{p.title}</h3>
                  <p className="text-xs text-slate-500">{p.trainer} • {p.venue}</p>
                  <p className="text-xs text-slate-500">{dayjs(p.schedule).format('MMM D, YYYY h:mm A')}</p>
                  <p className="mt-1 text-xs text-slate-400">{p.enrolled_count}/{p.max_slots} enrolled</p>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="mt-3"
                    onClick={exportReport}
                    disabled={exporting}
                  >
                    <Download className="h-3.5 w-3.5" /> Export Report
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent title="Create Training Program">
          <div className="space-y-3">
            <div>
              <Label>Title</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div>
              <Label>Trainer</Label>
              <Input value={form.trainer} onChange={(e) => setForm({ ...form, trainer: e.target.value })} />
            </div>
            <div>
              <Label>Venue</Label>
              <Input value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} />
            </div>
            <div>
              <Label>Schedule</Label>
              <div className="grid grid-cols-2 gap-3">
                <DatePicker
                  value={splitScheduledDate(form.schedule).date}
                  onChange={(date) => setForm({ ...form, schedule: joinScheduledDate(date, splitScheduledDate(form.schedule).time) })}
                />
                <TimePicker
                  value={splitScheduledDate(form.schedule).time}
                  onChange={(time) => setForm({ ...form, schedule: joinScheduledDate(splitScheduledDate(form.schedule).date, time) })}
                />
              </div>
            </div>
            <div>
              <Label>Max Slots</Label>
              <Input type="number" value={form.max_slots} onChange={(e) => setForm({ ...form, max_slots: e.target.value })} />
            </div>
            <div className="flex justify-end">
              <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating…' : 'Create Program'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
