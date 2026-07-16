import { ChevronRight, Home } from 'lucide-react'
import { Link } from 'react-router-dom'

export function Breadcrumb({ items = [] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-text-muted">
      <Home className="h-3.5 w-3.5" />
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1
        return (
          <span key={item.label} className="flex items-center gap-1.5">
            <ChevronRight className="h-3.5 w-3.5 text-text-muted" />
            {item.href && !isLast ? (
              <Link to={item.href} className="hover:text-primary-700 dark:hover:text-primary-400">
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? 'font-medium text-text-primary' : ''}>{item.label}</span>
            )}
          </span>
        )
      })}
    </nav>
  )
}
