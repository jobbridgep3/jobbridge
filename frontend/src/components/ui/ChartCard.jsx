import { Card, CardContent, CardHeader, CardTitle } from './Card'
import { ChartSkeleton } from './Skeleton'
import { EmptyState } from './EmptyState'

/**
 * Wraps the Card/CardHeader/CardTitle/CardContent + loading/empty-state boilerplate
 * that every chart on the dashboard repeats (matches the pattern already established
 * by staff/LMI.jsx's single pie chart, generalized for 6 charts).
 */
export function ChartCard({ title, icon: Icon, isLoading, isEmpty, emptyTitle = 'No data yet', height = 280, children }) {
  if (isLoading) return <ChartSkeleton height={height} />

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {Icon && <Icon className="h-4 w-4 text-primary-600" />}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{isEmpty ? <EmptyState title={emptyTitle} /> : children}</CardContent>
    </Card>
  )
}
