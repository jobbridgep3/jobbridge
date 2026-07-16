import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { motion } from 'framer-motion'
import { Archive, Megaphone, Paperclip, Pencil, Pin, PinOff, Plus, Send, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
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
import { AnnouncementPreview } from '../../components/announcements/AnnouncementPreview'
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
const EMPTY_STAGED = { banner: null, images: [], pdf: null }

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
  const [formTab, setFormTab] = useState('edit') // 'edit' | 'preview'
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [staged, setStaged] = useState(EMPTY_STAGED)
  const [confirm, setConfirm] = useState(null) // { action, announcement }

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

  const uploadStagedMedia = async (announcementId) => {
    if (staged.banner) {
      const fd = new FormData()
      fd.append('file', staged.banner)
      await api.post(`/api/announcements/${announcementId}/banner`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    }
    for (const img of staged.images) {
      const fd = new FormData()
      fd.append('file', img)
      await api.post(`/api/announcements/${announcementId}/images`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    }
    if (staged.pdf) {
      const fd = new FormData()
      fd.append('file', staged.pdf)
      await api.post(`/api/announcements/${announcementId}/attachment`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    }
  }

  const saveMutation = useMutation({
    mutationFn: async (publishNow) => {
      const payload = buildPayload()
      const res = editing
        ? await api.put(`/api/announcements/${editing.id}`, { ...payload, publish_now: publishNow })
        : await api.post('/api/announcements', { ...payload, publish_now: publishNow })
      const announcement = res.data.data
      await uploadStagedMedia(announcement.id)
      return { announcement, publishNow }
    },
    onSuccess: ({ publishNow }) => {
      toast.success(publishNow ? 'Announcement published.' : form.scheduled_date ? 'Announcement scheduled.' : 'Draft saved.')
      setFormOpen(false)
      refresh()
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not save announcement.'),
  })

  const removeImage = useMutation({
    mutationFn: (url) => api.delete(`/api/announcements/${editing.id}/images`, { data: { url } }),
    onSuccess: (res) => {
      setEditing(res.data.data)
      refresh()
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not remove image.'),
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
    setStaged(EMPTY_STAGED)
    setFormTab('edit')
    setFormOpen(true)
  }
  const openEdit = (a) => {
    setEditing(a)
    setForm(announcementToForm(a))
    setStaged(EMPTY_STAGED)
    setFormTab('edit')
    setFormOpen(true)
  }

  const confirmCopy = {
    publish: { title: 'Publish this announcement?', description: 'Selected audience will receive an in-app notification and email.', label: 'Publish' },
    archive: { title: 'Archive this announcement?', description: 'It will no longer be visible to its audience.', label: 'Archive' },
    delete: { title: 'Delete this announcement?', description: 'This cannot be undone.', label: 'Delete' },
  }

  const isPublishedAlready = editing?.status === 'published'
  const canSave = form.title.trim() && form.body.trim() && form.target_roles.length > 0 && !saveMutation.isPending

  const previewBannerUrl = useMemo(
    () => (staged.banner ? URL.createObjectURL(staged.banner) : editing?.banner_url),
    [staged.banner, editing?.banner_url]
  )
  const previewGalleryUrls = useMemo(
    () => [...(editing?.gallery_images || []).map((img) => img.url), ...staged.images.map((f) => URL.createObjectURL(f))],
    [editing?.gallery_images, staged.images]
  )

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

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent title={editing ? 'Edit Announcement' : 'New Announcement'} className="max-w-2xl">
          <div className="mb-3 flex rounded-lg border border-border p-0.5">
            {['edit', 'preview'].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setFormTab(t)}
                className={cn(
                  'flex-1 rounded-md px-3 py-1.5 text-xs font-medium capitalize',
                  formTab === t ? 'bg-primary-800 text-white' : 'text-text-secondary hover:bg-surface-hover'
                )}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="max-h-[65vh] overflow-y-auto pr-1">
            {formTab === 'edit' ? (
              <AnnouncementForm
                form={form}
                setForm={setForm}
                staged={staged}
                setStaged={setStaged}
                existingMedia={editing}
                onRemoveImage={(url) => removeImage.mutate(url)}
              />
            ) : (
              <AnnouncementPreview
                form={form}
                bannerUrl={previewBannerUrl}
                galleryUrls={previewGalleryUrls}
                pdfName={staged.pdf?.name || (editing?.pdf_url ? 'Attached PDF' : null)}
              />
            )}
          </div>
          <div className="mt-4 flex justify-end gap-2">
            {isPublishedAlready ? (
              <Button onClick={() => saveMutation.mutate(false)} disabled={!canSave}>
                {saveMutation.isPending ? 'Saving…' : 'Save Changes'}
              </Button>
            ) : (
              <>
                <Button variant="secondary" onClick={() => saveMutation.mutate(false)} disabled={!canSave}>
                  {saveMutation.isPending ? 'Saving…' : 'Save as Draft'}
                </Button>
                <Button onClick={() => saveMutation.mutate(true)} disabled={!canSave}>
                  {saveMutation.isPending ? 'Publishing…' : 'Publish'}
                </Button>
              </>
            )}
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
