import { ChevronRight, Home } from 'lucide-react'
import { Link } from 'react-router-dom'

export function Breadcrumb({ items = [] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-slate-500">
      <Home className="h-3.5 w-3.5" />
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1
        return (
          <span key={item.label} className="flex items-center gap-1.5">
            <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
            {item.href && !isLast ? (
              <Link to={item.href} className="hover:text-primary-700">
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? 'font-medium text-slate-800' : ''}>{item.label}</span>
            )}
          </span>
        )
      })}
    </nav>
  )
}
