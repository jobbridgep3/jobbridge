import { flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useReactTable } from '@tanstack/react-table'
import { motion } from 'framer-motion'
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from 'lucide-react'
import { useState } from 'react'

import { staggerContainer, staggerItem } from '../../lib/motion'
import { cn } from '../../lib/utils'
import { EmptyState } from './EmptyState'
import { Input } from './Input'
import { Pagination } from './Pagination'
import { TableSkeleton } from './Skeleton'

export function DataTable({ columns, data, isLoading, searchPlaceholder = 'Search…', emptyTitle = 'No records found', emptyDescription, pageSize = 10 }) {
  const [globalFilter, setGlobalFilter] = useState('')
  const [sorting, setSorting] = useState([])

  const table = useReactTable({
    data: data || [],
    columns,
    state: { globalFilter, sorting },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  })

  const rows = table.getRowModel().rows

  return (
    <div className="rounded-xl border border-border bg-surface shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-3 border-b border-border-subtle p-4">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <Input placeholder={searchPlaceholder} value={globalFilter} onChange={(e) => setGlobalFilter(e.target.value)} className="pl-9" />
        </div>
      </div>

      {isLoading ? (
        <TableSkeleton />
      ) : rows.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-secondary text-xs uppercase tracking-wide text-text-muted">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className={cn('px-4 py-3 font-medium', header.column.getCanSort() && 'cursor-pointer select-none')}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <span className="inline-flex items-center gap-1">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanSort() &&
                          (header.column.getIsSorted() === 'asc' ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : header.column.getIsSorted() === 'desc' ? (
                            <ArrowDown className="h-3 w-3" />
                          ) : (
                            <ArrowUpDown className="h-3 w-3 text-text-muted" />
                          ))}
                      </span>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <motion.tbody variants={staggerContainer} initial="initial" animate="animate" className="divide-y divide-border-subtle">
              {rows.map((row) => (
                <motion.tr key={row.id} variants={staggerItem} className="hover:bg-surface-hover">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3 text-text-secondary">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </motion.tr>
              ))}
            </motion.tbody>
          </table>
        </div>
      )}

      {rows.length > 0 && (
        <Pagination
          page={table.getState().pagination.pageIndex + 1}
          pageCount={table.getPageCount()}
          onPageChange={(p) => table.setPageIndex(p - 1)}
          totalItems={table.getFilteredRowModel().rows.length}
          pageSize={table.getState().pagination.pageSize}
        />
      )}
    </div>
  )
}
