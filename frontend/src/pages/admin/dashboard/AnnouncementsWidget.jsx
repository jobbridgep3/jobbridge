import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import { Badge } from '../../../components/ui/Badge'
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card'
import { EmptyState } from '../../../components/ui/EmptyState'
import { CATEGORY_LABELS } from '../../../config/announcementMeta'
import api from '../../../lib/axios'

/** Shared "Latest Announcements" widget for the staff and admin dashboards
 * (mirrors SummaryCards/AnalyticsCharts/RecentActivity — one file here,
 * imported by both role dashboards). Staff/admin's GET /api/announcements
 * defaults to the full management view (every status), so this explicitly
 * asks for published-only, matching what jobseeker/employer dashboards get
 * by default. */
export function AnnouncementsWidget() {
  const { data: announcements } = useQuery({
    queryKey: ['announcements', 'published'],
    queryFn: async () => (await api.get('/api/announcements', { params: { status: 'published' } })).data.data,
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Latest Announcements</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!announcements?.length ? (
          <EmptyState title="No announcements yet" />
        ) : (
          announcements.slice(0, 4).map((a) => (
            <Link key={a.id} to={`/announcements/${a.id}`} className="block border-b border-border-subtle pb-2 last:border-0 hover:opacity-80">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-text-primary">{a.title}</p>
                <Badge variant="primary">{CATEGORY_LABELS[a.category] || a.category}</Badge>
              </div>
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  )
}
