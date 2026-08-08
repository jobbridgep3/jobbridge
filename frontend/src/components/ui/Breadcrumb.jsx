import { ChevronRight, Home } from 'lucide-react'
import { Link } from 'react-router-dom'

import { cn } from '../../lib/utils'

export function Breadcrumb({ items = [] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden text-sm text-text-muted">
      <Home className="h-3.5 w-3.5 shrink-0" />
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1
        return (
          <span key={item.label} className="flex min-w-0 items-center gap-1.5">
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-text-muted" />
            {item.href && !isLast ? (
              <Link to={item.href} className="shrink-0 hover:text-primary-700 dark:hover:text-primary-400">
                {item.label}
              </Link>
            ) : (
              <span className={cn('truncate', isLast && 'font-medium text-text-primary')}>{item.label}</span>
            )}
          </span>
        )
      })}
    </nav>
  )
}
