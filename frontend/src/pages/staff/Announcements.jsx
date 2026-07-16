import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { motion } from 'framer-motion'
import { Archive, FileText, ImagePlus, Megaphone, Paperclip, Pencil, Pin, PinOff, Plus, Send, Trash2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import toast from 'react-hot-toast'

import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card, CardContent } from '../../components/ui/Card'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Dialog, DialogContent } from '../../components/ui/Dialog'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { CardSkeleton } from '../../components/ui/Skeleton'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { AnnouncementForm } from '../../components/announcements/AnnouncementForm'
import { CATEGORY_LABELS } from '../../config/announcementMeta'
import api from '../../lib/axios'
import { fadeIn, staggerContainer, staggerItem } from '../../lib/motion'
import { cn } from '../../lib/utils'
import { useAuthStore } from '../../store/authStore'

const STATUS_TABS = [
  { key: '', label: 'All' },
  { key: 'draft', label: 'Draft' },
  { key: 'published', label: 'Published' },
  { key: 'archived', label: 'Archived' },
]

const EMPTY_FORM = {
  title: '', body: '', category: 'general', priority: 'normal', target_roles: ['public', 'jobseeker', 'employer', 'staff', 'admin'],
  scheduled_date: '', scheduled_time: '', expires_date: '',
}

function announcementToForm(a) {
  return {
    title: a.title || '',
    body: a.body || '',
    category: a.category || 'general',
    priority: a.priority || 'normal',
    target_roles: a.target_roles || [],
    scheduled_date: a.scheduled_publish_at ? a.scheduled_publish_at.slice(0, 10) : '',
    scheduled_time: '',
    expires_date: a.expires_at ? a.expires_at.slice(0, 10) : '',
  }
}

export default function StaffAnnouncements() {
  const queryClient = useQueryClient()
  const role = useAuthStore((s) => s.user?.role)
  const isAdmin = role === 'admin'
  const [statusTab, setStatusTab] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [confirm, setConfirm] = useState(null) // { action, announcement }
  const bannerRef = useRef(null)
  const imagesRef = useRef(null)
  const pdfRef = useRef(null)
  const [uploadTarget, setUploadTarget] = useState(null)

  const { data: announcements, isLoading } = useQuery({
    queryKey: ['staff', 'announcements', statusTab],
    queryFn: async () => (await api.get('/api/announcements', { params: statusTab ? { status: statusTab } : {} })).data.data,
  })

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['staff', 'announcements'] })

  const buildPayload = () => ({
    title: form.title,
    body: form.body,
    category: form.category,
    priority: form.priority,
    target_roles: form.target_roles,
    scheduled_publish_at: form.scheduled_date ? `${form.scheduled_date}T${form.scheduled_time ? to24h(form.scheduled_time) : '00:00'}:00` : null,
    expires_at: form.expires_date ? `${form.expires_date}T23:59:59` : null,
  })

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = buildPayload()
      const publishNow = !form.scheduled_date
      if (editing) return api.put(`/api/announcements/${editing.id}`, { ...payload, publish_now: publishNow })
      return api.post('/api/announcements', { ...payload, publish_now: publishNow })
    },
    onSuccess: () => {
      toast.success(editing ? 'Announcement updated.' : form.scheduled_date ? 'Announcement scheduled.' : 'Announcement published.')
      setFormOpen(false)
      refresh()
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not save announcement.'),
  })

  const lifecycle = useMutation({
    mutationFn: ({ action, announcement }) =>
      action === 'delete'
        ? api.delete(`/api/announcements/${announcement.id}`)
        : action === 'publish'
          ? api.post(`/api/announcements/${announcement.id}/publish`)
          : action === 'archive'
            ? api.post(`/api/announcements/${announcement.id}/archive`)
            : api.put(`/api/announcements/${announcement.id}/pin`, { is_pinned: !announcement.is_pinned }),
    onSuccess: (res) => {
      toast.success(res.data?.message || 'Done.')
      refresh()
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Action failed.'),
  })

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormOpen(true)
  }
  const openEdit = (a) => {
    setEditing(a)
    setForm(announcementToForm(a))
    setFormOpen(true)
  }

  const uploadFile = async (kind, file) => {
    if (!file || !uploadTarget) return
    try {
      const formData = new FormData()
      formData.append('file', file)
      const path = kind === 'banner' ? 'banner' : kind === 'pdf' ? 'attachment' : 'images'
      await api.post(`/api/announcements/${uploadTarget.id}/${path}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      toast.success('Uploaded.')
      refresh()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed.')
    } finally {
      setUploadTarget(null)
    }
  }

  const confirmCopy = {
    publish: { title: 'Publish this announcement?', description: 'Selected audience will receive an in-app notification and email.', label: 'Publish' },
    archive: { title: 'Archive this announcement?', description: 'It will no longer be visible to its audience.', label: 'Archive' },
    delete: { title: 'Delete this announcement?', description: 'This cannot be undone.', label: 'Delete' },
  }

  return (
    <motion.div {...fadeIn} className="space-y-4">
      <PageHeader
        title="Announcements"
        description="Create, schedule, and broadcast announcements across JobBridge."
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> New Announcement
          </Button>
        }
      />

      <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-surface p-1">
        {STATUS_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setStatusTab(t.key)}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-medium',
              statusTab === t.key ? 'bg-primary-800 text-white' : 'text-text-secondary hover:bg-surface-hover'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <CardSkeleton />
      ) : !announcements?.length ? (
        <EmptyState icon={Megaphone} title="No announcements in this view" />
      ) : (
        <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-3">
          {announcements.map((a) => (
            <motion.div key={a.id} variants={staggerItem}>
              <Card>
                <CardContent>
                  <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {a.is_pinned && <Pin className="h-3.5 w-3.5 text-primary-700 dark:text-primary-400" />}
                      <p className="text-sm font-semibold text-text-primary">{a.title}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <StatusBadge status={a.status} />
                      <Badge variant="primary">{CATEGORY_LABELS[a.category] || a.category}</Badge>
                      {a.priority !== 'normal' && <Badge variant={a.priority} className="capitalize">{a.priority}</Badge>}
                    </div>
                  </div>
                  <p className="text-xs text-text-muted">
                    {a.status === 'published' ? `Published ${dayjs(a.published_at).format('MMM D, YYYY h:mm A')} • Reached ${a.reach_count} users` : `Created by ${a.author_name || 'staff'}`}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {a.status !== 'archived' && (
                      <Button size="sm" variant="secondary" onClick={() => openEdit(a)}>
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </Button>
                    )}
                    {a.status === 'draft' && (
                      <Button size="sm" onClick={() => setConfirm({ action: 'publish', announcement: a })}>
                        <Send className="h-3.5 w-3.5" /> Publish
                      </Button>
                    )}
                    {a.status === 'published' && (
                      <Button size="sm" variant="ghost" onClick={() => setConfirm({ action: 'archive', announcement: a })}>
                        <Archive className="h-3.5 w-3.5" /> Archive
                      </Button>
                    )}
                    {isAdmin && a.status !== 'archived' && (
                      <Button size="sm" variant="secondary" onClick={() => lifecycle.mutate({ action: 'pin', announcement: a })}>
                        {a.is_pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />} {a.is_pinned ? 'Unpin' : 'Pin'}
                      </Button>
                    )}
                    <Button size="sm" variant="secondary" onClick={() => { setUploadTarget(a); bannerRef.current?.click() }}>
                      <ImagePlus className="h-3.5 w-3.5" /> Banner
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => { setUploadTarget(a); imagesRef.current?.click() }}>
                      <Upload className="h-3.5 w-3.5" /> Add Image
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => { setUploadTarget(a); pdfRef.current?.click() }}>
                      <FileText className="h-3.5 w-3.5" /> PDF
                    </Button>
                    <Button size="sm" variant="ghost" className="text-red-600" onClick={() => setConfirm({ action: 'delete', announcement: a })}>
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </Button>
                  </div>
                  {(a.banner_url || a.pdf_url || a.gallery_images?.length > 0) && (
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-text-muted">
                      {a.banner_url && <span>✓ Banner uploaded</span>}
                      {a.gallery_images?.length > 0 && <span>✓ {a.gallery_images.length} image(s)</span>}
                      {a.pdf_url && (
                        <a href={a.pdf_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary-700 hover:underline dark:text-primary-400">
                          <Paperclip className="h-3 w-3" /> PDF attached
                        </a>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}

      <input ref={bannerRef} type="file" accept="image/*" className="hidden" onChange={(e) => uploadFile('banner', e.target.files?.[0])} />
      <input ref={imagesRef} type="file" accept="image/*" className="hidden" onChange={(e) => uploadFile('image', e.target.files?.[0])} />
      <input ref={pdfRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => uploadFile('pdf', e.target.files?.[0])} />

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent title={editing ? 'Edit Announcement' : 'New Announcement'} className="max-w-2xl">
          <div className="max-h-[70vh] overflow-y-auto pr-1">
            <AnnouncementForm form={form} setForm={setForm} />
            <div className="mt-4 flex justify-end">
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={!form.title.trim() || !form.body.trim() || !form.target_roles.length || saveMutation.isPending}
              >
                {saveMutation.isPending
                  ? 'Saving…'
                  : form.scheduled_date
                    ? 'Schedule'
                    : editing
                      ? 'Save Changes'
                      : 'Publish Now'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={confirm ? confirmCopy[confirm.action].title : ''}
        description={confirm ? confirmCopy[confirm.action].description : ''}
        confirmLabel={confirm ? confirmCopy[confirm.action].label : ''}
        danger={confirm && confirm.action === 'delete'}
        onConfirm={() => {
          lifecycle.mutate(confirm)
          setConfirm(null)
        }}
      />
    </motion.div>
  )
}

function to24h(time12h) {
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec((time12h || '').trim())
  if (!match) return '00:00'
  let [, h, m, period] = match
  h = Number(h)
  if (period.toUpperCase() === 'PM' && h !== 12) h += 12
  if (period.toUpperCase() === 'AM' && h === 12) h = 0
  return `${String(h).padStart(2, '0')}:${m}`
}
