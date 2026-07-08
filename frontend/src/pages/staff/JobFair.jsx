import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { motion } from 'framer-motion'
import { Download, Plus, QrCode } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { Link } from 'react-router-dom'

import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card, CardContent } from '../../components/ui/Card'
import { Dialog, DialogContent } from '../../components/ui/Dialog'
import { EmptyState } from '../../components/ui/EmptyState'
import { Input, Label, Textarea } from '../../components/ui/Input'
import { PageHeader } from '../../components/ui/PageHeader'
import { CardSkeleton } from '../../components/ui/Skeleton'
import api from '../../lib/axios'
import { downloadFile, parseBlobError } from '../../lib/download'
import { fadeIn, staggerContainer, staggerItem } from '../../lib/motion'

export default function StaffJobFair({ basePath = '/staff' }) {
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', venue: '', event_date: '', max_employer_slots: 20, max_jobseeker_slots: 200 })

  const { data: fairs, isLoading } = useQuery({
    queryKey: ['jobfair'],
    queryFn: async () => (await api.get('/api/jobfair')).data.data,
  })

  const createMutation = useMutation({
    mutationFn: () => api.post('/api/staff/jobfair', form),
    onSuccess: () => {
      toast.success('Job fair created.')
      setCreateOpen(false)
      queryClient.invalidateQueries({ queryKey: ['jobfair'] })
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not create job fair.'),
  })

  const downloadAttendanceReport = async (fairId) => {
    try {
      await downloadFile(`/api/staff/jobfair/${fairId}/attendance-report`, { filename: 'jobfair_attendance.xlsx' })
    } catch (err) {
      toast.error(await parseBlobError(err))
    }
  }

  return (
    <motion.div {...fadeIn} className="space-y-4">
      <PageHeader
        title="Job Fair Management"
        description="Create, manage, and operate PESO job fair events including QR attendance."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> Create Job Fair
          </Button>
        }
      />

      {isLoading ? (
        <CardSkeleton />
      ) : !fairs?.length ? (
        <EmptyState icon={QrCode} title="No job fairs created yet" />
      ) : (
        <motion.div variants={staggerContainer} initial="initial" animate="animate" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {fairs.map((fair) => (
            <motion.div key={fair.id} variants={staggerItem}>
              <Card>
                <CardContent>
                  <div className="mb-2 flex items-start justify-between">
                    <h3 className="text-sm font-semibold text-slate-900">{fair.name}</h3>
                    <Badge className="capitalize">{fair.status}</Badge>
                  </div>
                  <p className="text-xs text-slate-500">{fair.venue}</p>
                  <p className="text-xs text-slate-500">{dayjs(fair.event_date).format('MMM D, YYYY h:mm A')}</p>
                  <p className="mt-1 text-xs text-slate-400">{fair.registered_employers} employers • {fair.registered_jobseekers} jobseekers</p>
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" asChild>
                      <Link to={`${basePath}/jobfair/${fair.id}/scanner`}>
                        <QrCode className="h-3.5 w-3.5" /> QR Scanner
                      </Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => downloadAttendanceReport(fair.id)}
                    >
                      <Download className="h-3.5 w-3.5" /> Attendance Report
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent title="Create Job Fair">
          <div className="space-y-3">
            <div>
              <Label>Event Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div>
              <Label>Venue</Label>
              <Input value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} />
            </div>
            <div>
              <Label>Date & Time</Label>
              <Input type="datetime-local" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Max Employer Slots</Label>
                <Input type="number" value={form.max_employer_slots} onChange={(e) => setForm({ ...form, max_employer_slots: e.target.value })} />
              </div>
              <div>
                <Label>Max Jobseeker Slots</Label>
                <Input type="number" value={form.max_jobseeker_slots} onChange={(e) => setForm({ ...form, max_jobseeker_slots: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating…' : 'Create Job Fair'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
