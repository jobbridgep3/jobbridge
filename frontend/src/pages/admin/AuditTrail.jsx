import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ArrowDownAZ, ArrowUpAZ, Download } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'

import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card, CardContent } from '../../components/ui/Card'
import { DataTable } from '../../components/ui/DataTable'
import { Input, Label, Select } from '../../components/ui/Input'
import { PageHeader } from '../../components/ui/PageHeader'
import { Pagination } from '../../components/ui/Pagination'
import api from '../../lib/axios'
import { downloadFile, parseBlobError } from '../../lib/download'
import { fadeIn } from '../../lib/motion'

const EMPTY_FILTERS = {
  date_from: '', date_to: '', user_email: '', user_role: '', module: '', action: '', status: '', q: '',
}

const ACTIONS = ['Login', 'Account Create', 'Create', 'Update', 'Delete', 'Approve', 'Reject', 'Password Change', 'Export', 'Generate']

export default function AdminAuditTrail() {
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState('desc')
  const [exporting, setExporting] = useState(null)

  const setFilter = (field) => (e) => {
    setFilters((f) => ({ ...f, [field]: e.target.value }))
    setPage(1)
  }

  const activeParams = { ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== '')), page, limit: 50, sort }

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'audit', activeParams],
    queryFn: async () => (await api.get('/api/admin/audit', { params: activeParams })).data.data,
  })

  const entries = data?.items || []
  const total = data?.total || 0
  const pageCount = Math.max(Math.ceil(total / 50), 1)

  const handleExport = async (format) => {
    setExporting(format)
    try {
      const exportParams = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== ''))
      await downloadFile(`/api/admin/audit/export/${format}`, {
        params: exportParams,
        filename: `audit_trail.${format === 'excel' ? 'xlsx' : 'pdf'}`,
      })
    } catch (err) {
      toast.error(await parseBlobError(err))
    } finally {
      setExporting(null)
    }
  }

  const columns = [
    { accessorKey: 'created_at', header: 'Timestamp', cell: ({ row }) => new Date(row.original.created_at).toLocaleString() },
    { accessorKey: 'user_email', header: 'User', cell: ({ row }) => row.original.user_email || 'System' },
    { accessorKey: 'user_role', header: 'Role', cell: ({ row }) => (row.original.user_role ? <Badge className="capitalize">{row.original.user_role}</Badge> : '—') },
    { accessorKey: 'action', header: 'Action' },
    { accessorKey: 'module', header: 'Module' },
    { accessorKey: 'record_id', header: 'Target Record', cell: ({ row }) => row.original.record_id || '—' },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <Badge variant={row.original.status === 'failed' ? 'danger' : 'success'} className="capitalize">{row.original.status}</Badge>,
    },
    { accessorKey: 'ip_address', header: 'IP Address', cell: ({ row }) => row.original.ip_address || '—' },
  ]

  return (
    <motion.div {...fadeIn} className="space-y-4">
      <PageHeader
        title="Audit Trail"
        description="Complete immutable log of every significant action across all roles."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => handleExport('excel')} disabled={exporting === 'excel'}>
              <Download className="h-4 w-4" /> Excel
            </Button>
            <Button variant="secondary" size="sm" onClick={() => handleExport('pdf')} disabled={exporting === 'pdf'}>
              <Download className="h-4 w-4" /> PDF
            </Button>
          </>
        }
      />

      <Card>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label>Date From</Label>
            <Input type="date" value={filters.date_from} onChange={setFilter('date_from')} />
          </div>
          <div>
            <Label>Date To</Label>
            <Input type="date" value={filters.date_to} onChange={setFilter('date_to')} />
          </div>
          <div>
            <Label>User Email</Label>
            <Input value={filters.user_email} onChange={setFilter('user_email')} placeholder="Search by email…" />
          </div>
          <div>
            <Label>Role</Label>
            <Select value={filters.user_role} onChange={setFilter('user_role')}>
              <option value="">All Roles</option>
              <option value="jobseeker">Jobseeker</option>
              <option value="employer">Employer</option>
              <option value="staff">PESO Staff</option>
              <option value="admin">Admin</option>
            </Select>
          </div>
          <div>
            <Label>Module</Label>
            <Input value={filters.module} onChange={setFilter('module')} placeholder="e.g. jobseekers" />
          </div>
          <div>
            <Label>Action</Label>
            <Select value={filters.action} onChange={setFilter('action')}>
              <option value="">All Actions</option>
              {ACTIONS.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={filters.status} onChange={setFilter('status')}>
              <option value="">All</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
            </Select>
          </div>
          <div>
            <Label>Search</Label>
            <Input value={filters.q} onChange={setFilter('q')} placeholder="Email or remarks…" />
          </div>
          <div className="flex items-end gap-2 lg:col-span-4">
            <Button variant="secondary" size="sm" onClick={() => { setFilters(EMPTY_FILTERS); setPage(1) }}>
              Clear Filters
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setSort((s) => (s === 'desc' ? 'asc' : 'desc'))}
            >
              {sort === 'desc' ? <ArrowDownAZ className="h-4 w-4" /> : <ArrowUpAZ className="h-4 w-4" />}
              {sort === 'desc' ? 'Newest First' : 'Oldest First'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <DataTable columns={columns} data={entries} isLoading={isLoading} searchPlaceholder="Refine this page…" emptyTitle="No audit entries match these filters" pageSize={50} />
      <Pagination page={page} pageCount={pageCount} onPageChange={setPage} totalItems={total} pageSize={50} />
    </motion.div>
  )
}
