import { useQuery } from '@tanstack/react-query'
import { Megaphone } from 'lucide-react'

import { AnnouncementCard } from '../../components/announcements/AnnouncementCard'
import { AnnouncementCarousel } from '../../components/announcements/AnnouncementCarousel'
import { EmptyState } from '../../components/ui/EmptyState'
import { Skeleton } from '../../components/ui/Skeleton'
import api from '../../lib/axios'

export default function PublicAnnouncements() {
  const { data: announcements, isLoading } = useQuery({
    queryKey: ['announcements', 'public'],
    queryFn: async () => (await api.get('/api/announcements/public')).data.data,
  })

  const pinned = (announcements || []).filter((a) => a.is_pinned).slice(0, 5)
  const rest = (announcements || []).filter((a) => !a.is_pinned)

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">Announcements</h1>
        <p className="mt-1 text-sm text-text-muted">Latest news and updates from PESO Pila.</p>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      )}

      {!isLoading && !(announcements || []).length && (
        <EmptyState icon={Megaphone} title="No announcements yet" description="Check back soon for updates." />
      )}

      {pinned.length > 0 && <AnnouncementCarousel announcements={pinned} />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rest.map((a) => (
          <AnnouncementCard key={a.id} announcement={a} />
        ))}
      </div>
    </div>
  )
}
