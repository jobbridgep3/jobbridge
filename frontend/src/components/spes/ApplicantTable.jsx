import dayjs from 'dayjs'
import { Link } from 'react-router-dom'

import { Button } from '../ui/Button'
import { Card, CardContent } from '../ui/Card'
import { DataTable } from '../ui/DataTable'
import { Input, Label, Select } from '../ui/Input'
import { StatusBadge } from '../ui/StatusBadge'

export const SPES_STATUSES = [
  'pending_review', 'approved_for_orientation', 'attended_orientation', 'failed_orientation',
  'rejected', 'passed', 'failed', 'for_deployment', 'deployed', 'completed', 'terminated',
]

/** Shared applicant list + filter UI for Staff's Applicants tab and Admin's read-only
 * Applicant Oversight tab (getRowLink omitted there, so no action column renders and
 * no navigation into a detail screen is offered — matching Admin's view-only scope). */
export function ApplicantTable({ applications, isLoading, batches, filters, onFilterChange, getRowLink }) {
  const columns = [
    { accessorKey: 'full_name', header: 'Applicant' },
    { accessorKey: 'batch_name', header: 'Batch' },
    {
      accessorKey: 'submitted_at',
      header: 'Submitted',
      cell: ({ row }) => dayjs(row.original.submitted_at).format('MMM D, YYYY'),
    },
    { accessorKey: 'gwa', header: 'GWA' },
    {
      accessorKey: 'family_income',
      header: 'Family Income',
      cell: ({ row }) => (row.original.family_income != null ? `₱${Number(row.original.family_income).toLocaleString()}` : '—'),
    },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    ...(getRowLink
      ? [
          {
            id: 'actions',
            header: '',
            cell: ({ row }) => (
              <Link to={getRowLink(row.original)}>
                <Button size="sm" variant="secondary">View</Button>
              </Link>
            ),
          },
        ]
      : []),
  ]

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label>Batch</Label>
            <Select value={filters.batchId} onChange={(e) => onFilterChange({ ...filters, batchId: e.target.value })}>
              <option value="">All Batches</option>
              {(batches || []).map((b) => (
                <option key={b.id} value={b.id}>{b.batch_name}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={filters.status} onChange={(e) => onFilterChange({ ...filters, status: e.target.value })}>
              <option value="">All Statuses</option>
              {SPES_STATUSES.map((s) => (
                <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
              ))}
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label>Search Applicant</Label>
            <Input placeholder="Search by name…" value={filters.search} onChange={(e) => onFilterChange({ ...filters, search: e.target.value })} />
          </div>
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        data={applications}
        isLoading={isLoading}
        searchPlaceholder="Refine current results…"
        emptyTitle="No SPES applicants match these filters"
      />
    </div>
  )
}
