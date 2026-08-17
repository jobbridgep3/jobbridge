import { useQuery } from '@tanstack/react-query'
import { Megaphone } from 'lucide-react'
import { Link } from 'react-router-dom'

import { AnnouncementCarousel } from '../../../components/announcements/AnnouncementCarousel'
import { Card, CardContent } from '../../../components/ui/Card'
import api from '../../../lib/axios'

export function AnnouncementsPanel() {
  const { data: announcements } = useQuery({
    queryKey: ['announcements', 'public'],
    queryFn: async () => (await api.get('/api/announcements/public')).data.data,
  })

  const list = announcements || []
  const gallery = list.slice(0, 5)

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

      <CardContent className="flex-1 p-5">
        {!list.length ? <p className="text-sm text-text-muted">No announcements yet.</p> : <AnnouncementCarousel announcements={gallery} />}
      </CardContent>
    </Card>
  )
}
