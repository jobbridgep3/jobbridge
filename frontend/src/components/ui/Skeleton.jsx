import { cn } from '../../lib/utils'

export function Skeleton({ className, style }) {
  return <div className={cn('animate-pulse rounded-md bg-surface-hover', className)} style={style} />
}

export function TableSkeleton({ rows = 6, cols = 4 }) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4">
          {Array.from({ length: cols }).map((__, c) => (
            <Skeleton key={c} className="h-9 flex-1" />
          ))}
        </div>
      ))}
    </div>
  )
}

export function CardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-[var(--shadow-card)]">
      <Skeleton className="mb-3 h-4 w-1/3" />
      <Skeleton className="mb-2 h-3 w-full" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  )
}

export function ChartSkeleton({ height = 280 }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-[var(--shadow-card)]">
      <Skeleton className="mb-4 h-4 w-1/3" />
      <Skeleton className="w-full" style={{ height }} />
    </div>
  )
}
