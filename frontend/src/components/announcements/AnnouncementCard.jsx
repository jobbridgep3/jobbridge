import dayjs from 'dayjs'
import { Megaphone } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Badge } from '../ui/Badge'
import { Card, CardContent } from '../ui/Card'
import { CATEGORY_LABELS } from '../../config/announcementMeta'

function stripHtml(html) {
  if (!html) return ''
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

export function AnnouncementCard({ announcement }) {
  const excerpt = stripHtml(announcement.body).slice(0, 140)
  return (
    <Card className="overflow-hidden" hover>
      <Link to={`/announcements/${announcement.id}`} className="block">
        {announcement.banner_url ? (
          <img src={announcement.banner_url} alt={announcement.title} className="aspect-[16/9] w-full bg-surface-secondary object-contain" />
        ) : (
          <div className="flex aspect-[16/9] w-full items-center justify-center bg-surface-secondary">
            <Megaphone className="h-8 w-8 text-text-muted" />
          </div>
        )}
        <CardContent>
          <div className="mb-2 flex items-center justify-between gap-2">
            <Badge variant="primary">{CATEGORY_LABELS[announcement.category] || announcement.category}</Badge>
            {announcement.published_at && (
              <span className="text-xs text-text-muted">{dayjs(announcement.published_at).format('MMM D, YYYY')}</span>
            )}
          </div>
          <h3 className="mb-1 line-clamp-2 text-sm font-semibold text-text-primary">{announcement.title}</h3>
          {excerpt && <p className="line-clamp-2 text-xs text-text-muted">{excerpt}…</p>}
          <span className="mt-2 inline-block text-xs font-medium text-primary-700 dark:text-primary-400">Read More →</span>
        </CardContent>
      </Link>
    </Card>
  )
}
