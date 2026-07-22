import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { CalendarDays, MapPinned } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Button } from '../../../components/ui/Button'
import { Card, CardContent } from '../../../components/ui/Card'
import { Skeleton } from '../../../components/ui/Skeleton'
import api from '../../../lib/axios'

export function JobFairPanel() {
  const { data: fairs, isLoading } = useQuery({
    queryKey: ['public', 'jobfairs', 'home'],
    queryFn: async () => (await api.get('/api/jobfair', { params: { upcoming: 1 } })).data.data,
  })

  const topThree = (fairs || []).slice(0, 3)

  return (
    <Card className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-primary-600" />
          <h2 className="text-sm font-semibold text-text-primary">Job Fair</h2>
        </div>
        <Link to="/job-fair" className="text-xs font-medium text-primary-700 hover:underline dark:text-primary-400">
          View all job fairs →
        </Link>
      </div>

      <CardContent className="flex-1 space-y-3 divide-y divide-border-subtle p-0">
        {isLoading && (
          <div className="space-y-3 p-5">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        )}

        {!isLoading && topThree.length === 0 && (
          <p className="p-5 text-sm text-text-muted">No upcoming job fairs scheduled yet.</p>
        )}

        {topThree.map((fair) => {
          const date = dayjs(fair.event_date)
          return (
            <div key={fair.id} className="flex gap-3 px-5 py-4 first:pt-4">
              <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-lg border border-border bg-surface-secondary">
                <span className="text-[10px] font-semibold uppercase text-primary-700 dark:text-primary-400">{date.format('MMM')}</span>
                <span className="text-lg font-bold text-text-primary">{date.format('DD')}</span>
              </div>
              <div className="min-w-0 flex-1">
                <Link to={`/job-fair/${fair.id}`}>
                  <h3 className="truncate text-sm font-semibold text-text-primary hover:text-primary-700 dark:hover:text-primary-400">
                    {fair.name}
                  </h3>
                </Link>
                <p className="mt-0.5 text-xs text-text-muted">{date.format('MMMM D, YYYY · h:mm A')}</p>
                {fair.venue && (
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-text-muted">
                    <MapPinned className="h-3 w-3 shrink-0" /> <span className="truncate">{fair.venue}</span>
                  </p>
                )}
                <div className="mt-2">
                  <Button size="sm" variant="secondary" asChild>
                    <Link to={`/job-fair/${fair.id}`}>View Details</Link>
                  </Button>
                </div>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
