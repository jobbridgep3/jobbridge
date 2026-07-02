import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { motion } from 'framer-motion'
import { Megaphone, Plus } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'

import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card, CardContent } from '../../components/ui/Card'
import { Dialog, DialogContent } from '../../components/ui/Dialog'
import { EmptyState } from '../../components/ui/EmptyState'
import { Input, Label, Select, Textarea } from '../../components/ui/Input'
import { PageHeader } from '../../components/ui/PageHeader'
import { CardSkeleton } from '../../components/ui/Skeleton'
import api from '../../lib/axios'
import { fadeIn, staggerContainer, staggerItem } from '../../lib/motion'

export default function StaffAnnouncements() {
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState({ title: '', body: '', target_audience: 'all' })

  const { data: announcements, isLoading } = useQuery({
    queryKey: ['announcements'],
    queryFn: async () => (await api.get('/api/announcements')).data.data,
  })

  const createMutation = useMutation({
    mutationFn: () => api.post('/api/announcements', { ...form, publish_now: true }),
    onSuccess: () => {
      toast.success('Announcement published.')
      setCreateOpen(false)
      setForm({ title: '', body: '', target_audience: 'all' })
      queryClient.invalidateQueries({ queryKey: ['announcements'] })
    },
  })

  return (
    <motion.div {...fadeIn} className="space-y-4">
      <PageHeader
        title="Announcements"
        description="Create and broadcast announcements to jobseekers and/or employers."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> New Announcement
          </Button>
        }
      />

      {isLoading ? (
        <CardSkeleton />
      ) : !announcements?.length ? (
        <EmptyState icon={Megaphone} title="No announcements published yet" />
      ) : (
        <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-3">
          {announcements.map((a) => (
            <motion.div key={a.id} variants={staggerItem}>
              <Card>
                <CardContent>
                  <div className="mb-1 flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-900">{a.title}</p>
                    <Badge variant="primary" className="capitalize">{a.target_audience}</Badge>
                  </div>
                  <p className="text-sm text-slate-600">{a.body}</p>
                  <p className="mt-2 text-xs text-slate-400">
                    Published {dayjs(a.published_at).format('MMM D, YYYY h:mm A')} • Reached {a.reach_count} users
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent title="New Announcement">
          <div className="space-y-3">
            <div>
              <Label>Title</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <Label>Body</Label>
              <Textarea rows={5} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
            </div>
            <div>
              <Label>Target Audience</Label>
              <Select value={form.target_audience} onChange={(e) => setForm({ ...form, target_audience: e.target.value })}>
                <option value="all">All</option>
                <option value="jobseekers">Jobseekers Only</option>
                <option value="employers">Employers Only</option>
              </Select>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Publishing…' : 'Publish Now'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
