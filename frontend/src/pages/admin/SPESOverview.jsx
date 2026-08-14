import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { CalendarClock, GraduationCap, Users } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { StatCard } from '../../components/ui/StatCard'
import { ChartSkeleton } from '../../components/ui/Skeleton'
import api from '../../lib/axios'

export function SPESOverview() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'spes', 'overview'],
    queryFn: async () => (await api.get('/api/admin/spes/overview')).data.data,
  })

  if (isLoading || !data) return <ChartSkeleton />

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total Applicants (All Time)" value={data.total_applicants} icon={Users} tone="primary" />
        <StatCard label="Active Batches" value={data.active_batches} icon={GraduationCap} tone="success" />
        <StatCard label="Upcoming Deadlines" value={data.upcoming_deadlines.length} icon={CalendarClock} tone="warning" />
      </div>

      <Card>
        <CardHeader><CardTitle>Upcoming Registration Deadlines</CardTitle></CardHeader>
        <CardContent>
          {!data.upcoming_deadlines.length ? (
            <EmptyState title="No upcoming deadlines" />
          ) : (
            <ul className="space-y-2 text-sm">
              {data.upcoming_deadlines.map((b) => (
                <li key={b.batch_id} className="flex items-center justify-between">
                  <span className="text-text-secondary">{b.batch_name}</span>
                  <span className="text-text-muted">{dayjs(b.registration_deadline).format('MMM D, YYYY')}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>System-Wide Applicant Funnel</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            {[
              ['Pending Review', data.funnel.pending_review], ['Approved for Orientation', data.funnel.approved_for_orientation],
              ['Attended Orientation', data.funnel.attended_orientation], ['Failed Orientation', data.funnel.failed_orientation],
              ['Passed', data.funnel.passed], ['Failed', data.funnel.failed],
              ['Awaiting Deployment', data.funnel.for_deployment], ['Deployed', data.funnel.deployed],
              ['Completed', data.funnel.completed], ['Terminated', data.funnel.terminated], ['Rejected', data.funnel.rejected],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-border-subtle p-3">
                <p className="text-text-muted">{label}</p>
                <p className="text-lg font-semibold text-text-primary">{value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
