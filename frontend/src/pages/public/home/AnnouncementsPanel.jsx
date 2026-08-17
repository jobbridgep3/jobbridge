import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { Megaphone } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Card, CardContent } from '../../../components/ui/Card'
import api from '../../../lib/axios'

function stripHtml(html) {
  if (!html) return ''
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

export function AnnouncementsPanel() {
  const { data: announcements } = useQuery({
    queryKey: ['announcements', 'public'],
    queryFn: async () => (await api.get('/api/announcements/public')).data.data,
  })

  const list = announcements || []
  const [featured, ...rest] = list
  const others = rest.slice(0, 2)

  return (
    <Card className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
        <div className="flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-primary-600" />
          <h2 className="text-sm font-semibold text-text-primary">Announcements</h2>
        </div>
        <Link to="/announcements" className="text-xs font-medium text-primary-700 hover:underline dark:text-primary-400">
          View all announcements →
        </Link>
      </div>

      <CardContent className="flex-1 space-y-4 p-5">
        {!list.length && <p className="text-sm text-text-muted">No announcements yet.</p>}

        {featured && (
          <Link to={`/announcements/${featured.id}`} className="block overflow-hidden rounded-xl border border-border">
            {featured.banner_url ? (
              <img src={featured.banner_url} alt={featured.title} className="aspect-[16/9] w-full bg-surface-secondary object-cover" />
            ) : (
              <div className="flex aspect-[16/9] w-full items-center justify-center bg-primary-50 dark:bg-primary-900/30">
                <Megaphone className="h-8 w-8 text-primary-400" />
              </div>
            )}
            <div className="p-3">
              <h3 className="line-clamp-2 text-sm font-semibold text-text-primary">{featured.title}</h3>
              <p className="mt-1 text-xs text-text-muted">
                {featured.published_at && dayjs(featured.published_at).format('MMMM D, YYYY')}
              </p>
              <p className="mt-1 line-clamp-2 text-xs text-text-muted">{stripHtml(featured.body)}</p>
              <span className="mt-2 inline-block text-xs font-medium text-primary-700 dark:text-primary-400">Read More →</span>
            </div>
          </Link>
        )}

        {others.map((a) => (
          <Link key={a.id} to={`/announcements/${a.id}`} className="block border-t border-border-subtle pt-3">
            <h3 className="line-clamp-2 text-sm font-semibold text-text-primary">{a.title}</h3>
            <p className="mt-0.5 text-xs text-text-muted">{a.published_at && dayjs(a.published_at).format('MMMM D, YYYY')}</p>
            <p className="mt-1 line-clamp-2 text-xs text-text-muted">{stripHtml(a.body)}</p>
            <span className="mt-2 inline-block text-xs font-medium text-primary-700 dark:text-primary-400">Read More →</span>
          </Link>
        ))}
      </CardContent>
    </Card>
  )
}
