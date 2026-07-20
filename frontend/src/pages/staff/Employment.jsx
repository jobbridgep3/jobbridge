import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { motion } from 'framer-motion'
import { Building2, Download, FileDown, TrendingUp, UserCheck, Users } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'

import { Button } from '../../components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { DataTable } from '../../components/ui/DataTable'
import { DatePicker } from '../../components/ui/DatePicker'
import { Input, Label, Select } from '../../components/ui/Input'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatCard } from '../../components/ui/StatCard'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { useSocket } from '../../hooks/useSocket'
import api from '../../lib/axios'
import { downloadFile, parseBlobError } from '../../lib/download'
import { fadeIn } from '../../lib/motion'

const STATUS_OPTIONS = [
  { value: 'pending_deployment', label: 'Pending Deployment' },
  { value: 'active', label: 'Active Employee' },
  { value: 'probationary', label: 'Probationary' },
  { value: 'regular', label: 'Regular' },
  { value: 'contract_ended', label: 'Contract Ended' },
  { value: 'resigned', label: 'Resigned' },
  { value: 'terminated', label: 'Terminated' },
  { value: 'completed', label: 'Contract Ended (legacy)' },
]

function BarList({ title, items, valueKey = 'count' }) {
  const max = Math.max(...(items || []).map((i) => i[valueKey]), 1)
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {!items?.length ? (
          <p className="text-sm text-slate-500">No data yet.</p>
        ) : (
          items.map((item) => (
            <div key={item.name} className="flex items-center gap-2">
              <p className="w-36 truncate text-xs text-slate-600" title={item.name}>
                {item.name}
              </p>
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-primary-700" style={{ width: `${(item[valueKey] / max) * 100}%` }} />
              </div>
              <p className="w-8 text-right text-xs font-semibold text-slate-700">{item[valueKey]}</p>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}

export default function StaffEmployment() {
  const queryClient = useQueryClient()
  const [exporting, setExporting] = useState(false)
  const [filters, setFilters] = useState({ status: '', employer: '', industry: '', municipality: '', date_from: '', date_to: '' })

  const activeParams = Object.fromEntries(Object.entries(filters).filter(([, v]) => v))

  const { data: records, isLoading } = useQuery({
    queryKey: ['staff', 'employment', activeParams],
    queryFn: async () => (await api.get('/api/staff/employment', { params: activeParams })).data.data,
    placeholderData: keepPreviousData,
  })
  const { data: analytics } = useQuery({
    queryKey: ['staff', 'employment', 'analytics'],
    queryFn: async () => (await api.get('/api/staff/employment/analytics')).data.data,
  })

  useSocket({
    'employment:updated': () => {
      queryClient.invalidateQueries({ queryKey: ['staff', 'employment'] })
    },
  })

  const counts = analytics?.status_counts || {}

  const columns = [
    { accessorKey: 'jobseeker_name', header: 'Jobseeker' },
    { accessorKey: 'employer_name', header: 'Employer' },
    { accessorKey: 'position', header: 'Position' },
    {
      accessorKey: 'start_date',
      header: 'Start Date',
      cell: ({ row }) => (row.original.start_date ? dayjs(row.original.start_date).format('MMM D, YYYY') : '—'),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status} label={row.original.status_label} />,
    },
  ]

  const exportReport = async (format) => {
    setExporting(true)
    try {
      await downloadFile('/api/staff/employment/report', {
        params: { ...activeParams, format },
        filename: format === 'pdf' ? 'employment_report.pdf' : 'employment_report.xlsx',
      })
    } catch (err) {
      toast.error(await parseBlobError(err))
    } finally {
      setExporting(false)
    }
  }

  return (
    <motion.div {...fadeIn} className="space-y-4">
      <PageHeader
        title="Employment Monitoring"
        description="System-wide employment outcomes across all employers — primary source for LMI data."
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => exportReport('excel')} disabled={exporting}>
              <Download className="h-4 w-4" /> Excel
            </Button>
            <Button variant="secondary" size="sm" onClick={() => exportReport('pdf')} disabled={exporting}>
              <FileDown className="h-4 w-4" /> PDF
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Employed" value={analytics?.currently_employed ?? '–'} icon={Users} tone="primary" />
        <StatCard label="Employment Rate" value={analytics ? `${analytics.employment_rate}%` : '–'} icon={TrendingUp} tone="success" />
        <StatCard label="Placement Success" value={analytics ? `${analytics.placement_success_rate}%` : '–'} icon={UserCheck} tone="warning" />
        <StatCard label="Total Records" value={analytics?.total_records ?? '–'} icon={Building2} tone="danger" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          ['Active', counts.active],
          ['Probationary', counts.probationary],
          ['Regular', counts.regular],
          ['Pending Deployment', counts.pending_deployment],
          ['Resigned', counts.resigned],
          ['Terminated', counts.terminated],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-slate-200 bg-white p-3 text-center">
            <p className="text-lg font-semibold text-slate-900">{value ?? 0}</p>
            <p className="text-[11px] text-slate-500">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <BarList title="Top Hiring Employers" items={analytics?.top_employers} valueKey="hires" />
        <BarList title="Employment by Municipality" items={analytics?.by_municipality} />
        <BarList title="Employment by Industry" items={analytics?.by_industry} />
      </div>

      <Card>
        <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-6">
          <div>
            <Label>Status</Label>
            <Select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
              <option value="">All statuses</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Employer</Label>
            <Input placeholder="Company name" value={filters.employer} onChange={(e) => setFilters({ ...filters, employer: e.target.value })} />
          </div>
          <div>
            <Label>Industry</Label>
            <Input placeholder="e.g. Manufacturing" value={filters.industry} onChange={(e) => setFilters({ ...filters, industry: e.target.value })} />
          </div>
          <div>
            <Label>Municipality</Label>
            <Input placeholder="e.g. Pila" value={filters.municipality} onChange={(e) => setFilters({ ...filters, municipality: e.target.value })} />
          </div>
          <div>
            <Label>From</Label>
            <DatePicker value={filters.date_from} onChange={(date) => setFilters({ ...filters, date_from: date })} />
          </div>
          <div>
            <Label>To</Label>
            <DatePicker value={filters.date_to} onChange={(date) => setFilters({ ...filters, date_to: date })} />
          </div>
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        data={records}
        isLoading={isLoading}
        searchPlaceholder="Search employment records…"
        emptyTitle="No employment records match the current filters"
      />
    </motion.div>
  )
}
