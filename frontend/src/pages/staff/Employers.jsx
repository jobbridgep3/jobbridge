import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Download, Eye } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { Link, useSearchParams } from 'react-router-dom'

import { Button } from '../../components/ui/Button'
import { Card, CardContent } from '../../components/ui/Card'
import { DataTable } from '../../components/ui/DataTable'
import { DatePicker } from '../../components/ui/DatePicker'
import { Input, Label, Select } from '../../components/ui/Input'
import { PageHeader } from '../../components/ui/PageHeader'
import { Pagination } from '../../components/ui/Pagination'
import { StatusBadge } from '../../components/ui/StatusBadge'
import api from '../../lib/axios'
import { downloadFile, parseBlobError } from '../../lib/download'
import { fadeIn } from '../../lib/motion'
import { BUSINESS_TYPES } from '../employer/company-sections/options'

const EMPTY_FILTERS = { q: '', accreditation_status: '', industry: '', business_type: '', region_code: '', date_from: '', date_to: '' }
const LIMIT = 50

export default function StaffEmployers({ basePath = '/staff' }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [filters, setFilters] = useState({ ...EMPTY_FILTERS, ...Object.fromEntries(searchParams) })
  const [page, setPage] = useState(1)
  const [exporting, setExporting] = useState(null)

  const { data: regions } = useQuery({
    queryKey: ['lookups', 'psgc', 'regions'],
    queryFn: async () => (await api.get('/api/lookups/psgc/regions')).data.data,
    staleTime: Infinity,
  })

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

  const { data, isLoading } = useQuery({
    queryKey: ['staff', 'employers', activeParams],
    queryFn: async () => (await api.get('/api/staff/employers', { params: activeParams })).data.data,
  })

  const employers = data?.items || []
  const total = data?.total || 0
  const pageCount = Math.max(Math.ceil(total / LIMIT), 1)

  const handleExport = async (format) => {
    setExporting(format)
    try {
      const exportParams = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== ''))
      await downloadFile(`/api/staff/employers/export/${format}`, {
        params: exportParams,
        filename: `employers_export.${format === 'excel' ? 'xlsx' : 'pdf'}`,
      })
    } catch (err) {
      toast.error(await parseBlobError(err))
    } finally {
      setExporting(null)
    }
  }

  const columns = [
    { accessorKey: 'company_name', header: 'Company', cell: ({ row }) => row.original.company_name || '—' },
    { accessorKey: 'industry', header: 'Industry', cell: ({ row }) => row.original.industry || '—' },
    { accessorKey: 'business_type', header: 'Business Type', cell: ({ row }) => row.original.business_type?.replace(/_/g, ' ') || '—' },
    { accessorKey: 'region_name', header: 'Region', cell: ({ row }) => row.original.region_name || '—' },
    { accessorKey: 'accreditation_status', header: 'Accreditation', cell: ({ row }) => <StatusBadge status={row.original.accreditation_status} /> },
    { accessorKey: 'active_vacancies', header: 'Active Vacancies' },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <Button size="sm" variant="secondary" asChild>
          <Link to={`${basePath}/employers/${row.original.id}`}>
            <Eye className="h-3.5 w-3.5" /> View
          </Link>
        </Button>
      ),
    },
  ]

  return (
    <motion.div {...fadeIn} className="space-y-4">
      <PageHeader
        title="Employer Management"
        description="Search, filter, and manage all registered employer accounts."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => handleExport('excel')} disabled={exporting !== null}>
              <Download className="h-4 w-4" /> {exporting === 'excel' ? 'Exporting…' : 'Export Excel'}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => handleExport('pdf')} disabled={exporting !== null}>
              <Download className="h-4 w-4" /> {exporting === 'pdf' ? 'Exporting…' : 'Export PDF'}
            </Button>
          </>
        }
      />

      <Card>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label>Search</Label>
            <Input value={filters.q} onChange={setFilter('q')} placeholder="Company name or email…" />
          </div>
          <div>
            <Label>Accreditation Status</Label>
            <Select value={filters.accreditation_status} onChange={setFilter('accreditation_status')}>
              <option value="">All</option>
              <option value="not_submitted">Not Submitted</option>
              <option value="pending_review">Pending Review</option>
              <option value="accredited">Accredited</option>
              <option value="rejected">Rejected</option>
              <option value="suspended">Suspended</option>
            </Select>
          </div>
          <div>
            <Label>Industry</Label>
            <Input value={filters.industry} onChange={setFilter('industry')} placeholder="e.g. IT-BPM" />
          </div>
          <div>
            <Label>Business Type</Label>
            <Select value={filters.business_type} onChange={setFilter('business_type')}>
              <option value="">All</option>
              {BUSINESS_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Region</Label>
            <Select value={filters.region_code} onChange={setFilter('region_code')}>
              <option value="">All</option>
              {(regions || []).map((r) => (
                <option key={r.region_code} value={r.region_code}>{r.region_name}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Registered From</Label>
            <DatePicker value={filters.date_from} onChange={setFilterValue('date_from')} maxDate={filters.date_to} />
          </div>
          <div>
            <Label>Registered To</Label>
            <DatePicker value={filters.date_to} onChange={setFilterValue('date_to')} minDate={filters.date_from} />
          </div>
          <div className="flex items-end">
            <Button
              variant="secondary" size="sm"
              onClick={() => { setFilters(EMPTY_FILTERS); setPage(1); setSearchParams({}) }}
            >
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      <DataTable columns={columns} data={employers} isLoading={isLoading} searchPlaceholder="Refine this page…" emptyTitle="No employers match these filters" pageSize={LIMIT} />
      <Pagination page={page} pageCount={pageCount} onPageChange={setPage} totalItems={total} pageSize={LIMIT} />
    </motion.div>
  )
}
