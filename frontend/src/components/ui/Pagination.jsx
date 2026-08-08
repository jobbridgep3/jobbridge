import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from './Button'

export function Pagination({ page, pageCount, onPageChange, totalItems, pageSize }) {
  if (pageCount <= 1) return null
  const start = (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, totalItems)

  return (
    <div className="flex flex-col gap-2 border-t border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-center text-xs text-slate-500 sm:text-left">
        Showing <span className="font-medium text-slate-700">{start}</span>–<span className="font-medium text-slate-700">{end}</span> of{' '}
        <span className="font-medium text-slate-700">{totalItems}</span>
      </p>
      <div className="flex items-center justify-center gap-1 sm:justify-end">
        <Button variant="secondary" size="icon" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="px-2 text-xs text-slate-600">
          Page {page} of {pageCount}
        </span>
        <Button variant="secondary" size="icon" onClick={() => onPageChange(page + 1)} disabled={page >= pageCount}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
