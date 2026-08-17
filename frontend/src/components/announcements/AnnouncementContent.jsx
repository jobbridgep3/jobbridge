import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { ChevronLeft, ChevronRight, FileText, Megaphone } from 'lucide-react'
import { useState } from 'react'

import { AnnouncementCard } from './AnnouncementCard'
import { Badge } from '../ui/Badge'
import { Card, CardContent } from '../ui/Card'
import { Dialog, DialogContent } from '../ui/Dialog'
import { EmptyState } from '../ui/EmptyState'
import { CardSkeleton } from '../ui/Skeleton'
import { CATEGORY_LABELS } from '../../config/announcementMeta'
import api from '../../lib/axios'
import { useAuthStore } from '../../store/authStore'

/** Fetches and renders a single announcement's full body — banner, badges,
 * title/meta, HTML body, gallery/lightbox, PDF attachment, and related
 * announcements. Shared between the public detail page and the dashboard
 * detail page so only the surrounding layout (navbar/footer vs. minimal
 * bar) differs between the two. */
export function AnnouncementContent({ id, basePath = '/announcements' }) {
  const token = useAuthStore((s) => s.token)
  // Index into gallery_images (not a URL) so the lightbox can navigate prev/next
  // without needing to re-look-up position from a URL.
  const [lightboxIndex, setLightboxIndex] = useState(null)

  const { data: announcement, isLoading, error } = useQuery({
    queryKey: ['announcements', id, Boolean(token)],
    queryFn: async () => (await api.get(`/api/announcements/${id}`)).data.data,
  })

  if (isLoading) {
    return <CardSkeleton />
  }

  if (error || !announcement) {
    return (
      <EmptyState icon={Megaphone} title="Announcement not found" description="It may have been unpublished or you don't have access to it." />
    )
  }

  const galleryImages = announcement.gallery_images || []
  const showPrevImage = () => setLightboxIndex((i) => (i - 1 + galleryImages.length) % galleryImages.length)
  const showNextImage = () => setLightboxIndex((i) => (i + 1) % galleryImages.length)

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        {announcement.banner_url && (
          <img src={announcement.banner_url} alt={announcement.title} className="aspect-[16/9] w-full bg-surface-secondary object-contain" />
        )}
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="primary">{CATEGORY_LABELS[announcement.category] || announcement.category}</Badge>
            {announcement.priority !== 'normal' && <Badge variant={announcement.priority} className="capitalize">{announcement.priority}</Badge>}
          </div>
          <div>
            <h1 className="text-xl font-semibold text-text-primary">{announcement.title}</h1>
            <p className="mt-1 text-xs text-text-muted">
              {announcement.published_at && dayjs(announcement.published_at).format('MMMM D, YYYY h:mm A')}
              {announcement.author_name ? ` · ${announcement.author_name}` : ''}
            </p>
          </div>

          <div className="prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: announcement.body }} />

          {announcement.gallery_images?.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium text-text-secondary">Gallery</p>
              <div className="grid grid-cols-3 gap-2">
                {announcement.gallery_images.map((img, i) => (
                  <img
                    key={i}
                    src={img.url}
                    alt={img.name || ''}
                    className="aspect-square cursor-pointer rounded-lg object-cover"
                    onClick={() => setLightboxIndex(i)}
                  />
                ))}
              </div>
            </div>
          )}

          {announcement.pdf_url && (
            <a
              href={announcement.pdf_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-primary-700 hover:bg-surface-hover dark:text-primary-400"
            >
              <FileText className="h-4 w-4" /> View PDF Attachment
            </a>
          )}
        </CardContent>
      </Card>

      {announcement.related?.length > 0 && (
        <div>
          <p className="mb-3 text-sm font-semibold text-text-primary">Related Announcements</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {announcement.related.map((a) => (
              <AnnouncementCard key={a.id} announcement={a} basePath={basePath} />
            ))}
          </div>
        </div>
      )}

      <Dialog open={lightboxIndex !== null} onOpenChange={(open) => !open && setLightboxIndex(null)}>
        <DialogContent className="max-w-3xl">
          {lightboxIndex !== null && (
            <div className="relative">
              <img src={galleryImages[lightboxIndex].url} alt="" className="w-full rounded-lg object-contain" />
              {galleryImages.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={showPrevImage}
                    aria-label="Previous image"
                    className="absolute left-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-surface/80 text-text-secondary shadow hover:bg-surface"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={showNextImage}
                    aria-label="Next image"
                    className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-surface/80 text-text-secondary shadow hover:bg-surface"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-slate-900/60 px-2 py-0.5 text-xs text-white">
                    {lightboxIndex + 1} / {galleryImages.length}
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
