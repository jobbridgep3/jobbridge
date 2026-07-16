import dayjs from 'dayjs'
import { FileText, Megaphone } from 'lucide-react'

import { Badge } from '../ui/Badge'
import { CATEGORY_LABELS } from '../../config/announcementMeta'

/** Renders a form-in-progress exactly as AnnouncementDetails.jsx renders a
 * published announcement, so "Preview" shows the real final appearance —
 * `bannerUrl`/`galleryUrls`/`pdfName` can be staged local object-URLs (unsaved
 * files) or already-uploaded URLs (edit mode), the rendering doesn't care. */
export function AnnouncementPreview({ form, bannerUrl, galleryUrls = [], pdfName }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      {bannerUrl ? (
        <img src={bannerUrl} alt={form.title} className="aspect-[16/9] w-full bg-surface-secondary object-contain" />
      ) : (
        <div className="flex aspect-[16/9] w-full items-center justify-center bg-surface-secondary">
          <Megaphone className="h-8 w-8 text-text-muted" />
        </div>
      )}
      <div className="space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="primary">{CATEGORY_LABELS[form.category] || form.category}</Badge>
          {form.priority !== 'normal' && <Badge variant={form.priority} className="capitalize">{form.priority}</Badge>}
        </div>
        <div>
          <h1 className="text-lg font-semibold text-text-primary">{form.title || 'Untitled announcement'}</h1>
          <p className="mt-1 text-xs text-text-muted">{dayjs().format('MMMM D, YYYY h:mm A')} (preview)</p>
        </div>
        {form.body ? (
          <div className="prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: form.body }} />
        ) : (
          <p className="text-sm text-text-muted">No content written yet.</p>
        )}
        {galleryUrls.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-medium text-text-secondary">Gallery</p>
            <div className="grid grid-cols-3 gap-2">
              {galleryUrls.map((url, i) => (
                <img key={i} src={url} alt="" className="aspect-square rounded-lg object-cover" />
              ))}
            </div>
          </div>
        )}
        {pdfName && (
          <div className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-primary-700 dark:text-primary-400">
            <FileText className="h-4 w-4" /> {pdfName}
          </div>
        )}
      </div>
    </div>
  )
}
