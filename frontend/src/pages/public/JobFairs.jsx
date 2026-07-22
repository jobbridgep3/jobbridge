import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { CalendarDays, MapPinned } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Card, CardContent } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Skeleton } from '../../components/ui/Skeleton'
import api from '../../lib/axios'

export default function PublicJobFairs() {
  const { data: fairs, isLoading } = useQuery({
    queryKey: ['public', 'jobfairs', 'list'],
    queryFn: async () => (await api.get('/api/jobfair', { params: { upcoming: 1 } })).data.data,
  })

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">Job Fair</h1>
        <p className="mt-1 text-sm text-text-muted">Upcoming PESO Pila job fairs — register once logged in as a jobseeker.</p>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      )}

      {!isLoading && !(fairs || []).length && (
        <EmptyState icon={CalendarDays} title="No upcoming job fairs" description="Check back soon for the next scheduled event." />
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(fairs || []).map((fair) => (
          <Card key={fair.id} hover className="overflow-hidden">
            <Link to={`/job-fair/${fair.id}`} className="block">
              {fair.banner_url && <img src={fair.banner_url} alt={fair.name} className="aspect-[16/9] w-full bg-surface-secondary object-cover" />}
              <CardContent>
                <h3 className="line-clamp-2 text-sm font-semibold text-text-primary">{fair.name}</h3>
                <p className="mt-1 flex items-center gap-1 text-xs text-text-muted">
                  <CalendarDays className="h-3 w-3" /> {dayjs(fair.event_date).format('MMMM D, YYYY · h:mm A')}
                </p>
                {fair.venue && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-text-muted">
                    <MapPinned className="h-3 w-3" /> {fair.venue}
                  </p>
                )}
                {fair.description && <p className="mt-2 line-clamp-2 text-xs text-text-muted">{fair.description}</p>}
              </CardContent>
            </Link>
          </Card>
        ))}
      </div>
    </div>
  )
}
