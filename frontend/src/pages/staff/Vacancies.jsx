import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  BarChart3, Briefcase, CheckCircle2, Clock, Download, Eye, FileX, MoreHorizontal, ShieldCheck, XCircle,
} from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { Link, useSearchParams } from 'react-router-dom'

import { Button } from '../../components/ui/Button'
import { Card, CardContent } from '../../components/ui/Card'
import { DataTable } from '../../components/ui/DataTable'
import { DatePicker } from '../../components/ui/DatePicker'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../../components/ui/DropdownMenu'
import { Dialog, DialogContent } from '../../components/ui/Dialog'
import { Input, Label, Select, Textarea } from '../../components/ui/Input'
import { Pagination } from '../../components/ui/Pagination'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatCard } from '../../components/ui/StatCard'
import { StatusBadge } from '../../components/ui/StatusBadge'
import api from '../../lib/axios'
import { downloadFile, parseBlobError } from '../../lib/download'
import { fadeIn } from '../../lib/motion'
import { canTransition } from '../../lib/vacancyStateMachine'
import { useAuthStore } from '../../store/authStore'
import { VacancyAnalytics } from './vacancy-management/VacancyAnalytics'

const EMPTY_FILTERS = { q: '', status: '', category_id: '', industry: '', municipality: '', job_type: '', date_from: '', date_to: '' }
const LIMIT = 50

export default function StaffVacancies({ basePath = '/staff' }) {
  const role = useAuthStore((s) => s.user?.role)
  const [searchParams, setSearchParams] = useSearchParams()
  const [filters, setFilters] = useState({ ...EMPTY_FILTERS, ...Object.fromEntries(searchParams) })
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState(new Set())
  const [exporting, setExporting] = useState(false)
  const [showAnalytics, setShowAnalytics] = useState(false)
  const [bulkAction, setBulkAction] = useState(null) // { action } | null
  const [bulkRemarks, setBulkRemarks] = useState('')
  const [bulkResult, setBulkResult] = useState(null)

  const setFilterValue = (field) => (value) => {
    setFilters((f) => ({ ...f, [field]: value }))
    setPage(1)
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (value) next.set(field, value)
      else next.delete(field)
      return next
    })
  }
  const setFilter = (field) => (e) => setFilterValue(field)(e.target.value)

  const activeParams = { ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== '')), page, limit: LIMIT }

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['staff', 'vacancies', activeParams],
    queryFn: async () => (await api.get('/api/staff/vacancies', { params: activeParams })).data.data,
  })
  const { data: summary } = useQuery({
    queryKey: ['staff', 'vacancies', 'summary'],
    queryFn: async () => (await api.get('/api/staff/vacancies/summary')).data.data,
    refetchInterval: 60_000,
  })
  const { data: categories } = useQuery({
    queryKey: ['vacancies', 'categories'],
    queryFn: async () => (await api.get('/api/vacancies/categories')).data.data,
  })

  const vacancies = data?.items || []
  const total = data?.total || 0
  const pageCount = Math.max(Math.ceil(total / LIMIT), 1)

  const toggleSelected = (id) => {
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const runRowAction = async (vacancyId, endpoint, method = 'put', body) => {
    const url = endpoint ? `/api/staff/vacancies/${vacancyId}/${endpoint}` : `/api/staff/vacancies/${vacancyId}`
    try {
      await api[method](url, body)
      toast.success('Vacancy updated.')
      refetch()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update vacancy.')
    }
  }

  const handleExport = async (scope) => {
    setExporting(true)
    try {
      const exportParams = { ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== '')), scope }
      if (scope === 'selected') exportParams.ids = [...selected].join(',')
      if (scope === 'current_page') { exportParams.page = page; exportParams.limit = LIMIT }
      await downloadFile('/api/staff/vacancies/export/excel', { params: exportParams, filename: 'vacancies_export.xlsx' })
    } catch (err) {
      toast.error(await parseBlobError(err))
    } finally {
      setExporting(false)
    }
  }

  const runBulkAction = async () => {
    try {
      const res = await api.post('/api/staff/vacancies/bulk-action', {
        action: bulkAction.action, vacancy_ids: [...selected], remarks: bulkRemarks,
      })
      setBulkResult(res.data.data)
      setSelected(new Set())
      refetch()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Bulk action failed.')
    }
  }

  const cards = [
    { label: 'Total', value: summary?.total ?? '–', icon: Briefcase, tone: 'primary' },
    { label: 'Pending Approval', value: summary?.pending ?? '–', icon: Clock, tone: 'warning' },
    { label: 'Published', value: summary?.published ?? '–', icon: CheckCircle2, tone: 'success' },
    { label: 'Suspended', value: summary?.suspended ?? '–', icon: XCircle, tone: 'danger' },
    { label: 'Closed', value: summary?.closed ?? '–', icon: FileX, tone: 'default' },
    { label: 'Filled', value: summary?.filled ?? '–', icon: ShieldCheck, tone: 'success' },
  ]

  const columns = [
    {
      id: 'select',
      header: '',
      cell: ({ row }) => (
        <input type="checkbox" checked={selected.has(row.original.id)} onChange={() => toggleSelected(row.original.id)} className="rounded border-slate-300" />
      ),
    },
    { accessorKey: 'title', header: 'Job Title' },
    { accessorKey: 'company_name', header: 'Employer' },
    { accessorKey: 'industry', header: 'Industry', cell: ({ row }) => row.original.industry || '—' },
    { accessorKey: 'job_type', header: 'Type', cell: ({ row }) => row.original.job_type?.replace(/_/g, ' ') || '—' },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const v = row.original
        return (
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="secondary" asChild>
              <Link to={`${basePath}/vacancies/${v.id}`}>
                <Eye className="h-3.5 w-3.5" /> View
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {canTransition(v.status, 'approved', role) && (
                  <DropdownMenuItem onClick={() => runRowAction(v.id, 'approve')}>Approve</DropdownMenuItem>
                )}
                {canTransition(v.status, 'suspended', role) && (
                  <DropdownMenuItem onClick={() => runRowAction(v.id, 'suspend')}>Suspend</DropdownMenuItem>
                )}
                {canTransition(v.status, 'published', role) && v.status === 'suspended' && role === 'admin' && (
                  <DropdownMenuItem onClick={() => runRowAction(v.id, 'reactivate')}>Reactivate</DropdownMenuItem>
                )}
                {canTransition(v.status, 'closed', role) && (
                  <DropdownMenuItem onClick={() => runRowAction(v.id, 'close')}>Close</DropdownMenuItem>
                )}
                {role === 'admin' && (
                  <DropdownMenuItem
                    className="text-red-600"
                    onClick={() => { if (window.confirm('Delete this vacancy? It can be restored later.')) runRowAction(v.id, '', 'delete') }}
                  >
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )
      },
    },
  ]

  return (
    <motion.div {...fadeIn} className="space-y-4">
      <PageHeader
        title="Job Vacancy Management"
        description="Review, approve, and manage all job postings."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => setShowAnalytics((s) => !s)}>
              <BarChart3 className="h-4 w-4" /> {showAnalytics ? 'Hide Analytics' : 'Analytics'}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => handleExport('all')} disabled={exporting}>
              <Download className="h-4 w-4" /> Export (Filtered)
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((c) => <StatCard key={c.label} {...c} />)}
      </div>

      {showAnalytics && <VacancyAnalytics />}

      <Card>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label>Search</Label>
            <Input value={filters.q} onChange={setFilter('q')} placeholder="Title or employer…" />
          </div>
          <div>
            <Label>Status</Label>
            <Select value={filters.status} onChange={setFilter('status')}>
              <option value="">All</option>
              {['draft', 'pending', 'approved', 'rejected', 'published', 'suspended', 'closed', 'filled'].map((s) => (
                <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Category</Label>
            <Select value={filters.category_id} onChange={setFilter('category_id')}>
              <option value="">All</option>
              {(categories || []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Industry</Label>
            <Input value={filters.industry} onChange={setFilter('industry')} />
          </div>
          <div>
            <Label>Municipality</Label>
            <Input value={filters.municipality} onChange={setFilter('municipality')} />
          </div>
          <div>
            <Label>Employment Type</Label>
            <Input value={filters.job_type} onChange={setFilter('job_type')} placeholder="e.g. full_time" />
          </div>
          <div>
            <Label>Date From</Label>
            <DatePicker value={filters.date_from} onChange={setFilterValue('date_from')} maxDate={filters.date_to} />
          </div>
          <div>
            <Label>Date To</Label>
            <DatePicker value={filters.date_to} onChange={setFilterValue('date_to')} minDate={filters.date_from} />
          </div>
          <div className="flex items-end">
            <Button variant="secondary" size="sm" onClick={() => { setFilters(EMPTY_FILTERS); setPage(1); setSearchParams({}) }}>
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {selected.size > 0 && (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-slate-700">{selected.size} selected</span>
            <Button size="sm" variant="secondary" onClick={() => setBulkAction({ action: 'approve' })}>Bulk Approve</Button>
            <Button size="sm" variant="secondary" onClick={() => setBulkAction({ action: 'reject' })}>Bulk Reject</Button>
            <Button size="sm" variant="secondary" onClick={() => setBulkAction({ action: 'suspend' })}>Bulk Suspend</Button>
            <Button size="sm" variant="secondary" onClick={() => setBulkAction({ action: 'close' })}>Bulk Close</Button>
            {role === 'admin' && (
              <Button size="sm" variant="danger" onClick={() => setBulkAction({ action: 'delete' })}>Bulk Delete</Button>
            )}
            <Button size="sm" variant="secondary" onClick={() => handleExport('selected')} disabled={exporting}>
              <Download className="h-3.5 w-3.5" /> Export Selected
            </Button>
          </CardContent>
        </Card>
      )}

      <DataTable columns={columns} data={vacancies} isLoading={isLoading} searchPlaceholder="Refine this page…" emptyTitle="No vacancies match these filters" pageSize={LIMIT} />
      <Pagination page={page} pageCount={pageCount} onPageChange={setPage} totalItems={total} pageSize={LIMIT} />

      <Dialog open={bulkAction !== null} onOpenChange={(open) => !open && setBulkAction(null)}>
        <DialogContent title={`Bulk ${bulkAction?.action}`} description={`This will attempt to ${bulkAction?.action} ${selected.size} vacancy(ies).`}>
          {(bulkAction?.action === 'reject' || bulkAction?.action === 'suspend') && (
            <>
              <Label>Remarks {bulkAction?.action === 'reject' && '(required)'}</Label>
              <Textarea rows={3} value={bulkRemarks} onChange={(e) => setBulkRemarks(e.target.value)} />
            </>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setBulkAction(null)}>Cancel</Button>
            <Button size="sm" onClick={runBulkAction} disabled={bulkAction?.action === 'reject' && !bulkRemarks}>Confirm</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkResult !== null} onOpenChange={(open) => !open && (setBulkResult(null), setBulkAction(null), setBulkRemarks(''))}>
        <DialogContent title="Bulk Action Results" description={`${bulkResult?.succeeded?.length || 0} succeeded, ${bulkResult?.failed?.length || 0} failed.`}>
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {bulkResult?.failed?.map((f) => (
              <p key={f.id} className="text-xs text-red-600">{f.id}: {f.reason}</p>
            ))}
          </div>
          <div className="mt-4 flex justify-end">
            <Button size="sm" onClick={() => { setBulkResult(null); setBulkAction(null); setBulkRemarks('') }}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
