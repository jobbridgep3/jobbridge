import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { motion } from 'framer-motion'
import { Download, FileDown } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'

import { Button } from '../../components/ui/Button'
import { Card, CardContent } from '../../components/ui/Card'
import { DataTable } from '../../components/ui/DataTable'
import { DatePicker } from '../../components/ui/DatePicker'
import { Input, Label, Select } from '../../components/ui/Input'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatusBadge } from '../../components/ui/StatusBadge'
import api from '../../lib/axios'
import { downloadFile, parseBlobError } from '../../lib/download'
import { fadeIn } from '../../lib/motion'

const STATUS_OPTIONS = ['pending', 'accepted', 'declined', 'completed', 'cancelled', 'rescheduled']

export default function StaffInterviews() {
  const [exporting, setExporting] = useState(false)
  const [filters, setFilters] = useState({ status: '', employer: '', municipality: '', date_from: '', date_to: '' })

  const activeParams = Object.fromEntries(Object.entries(filters).filter(([, v]) => v))

  const { data: interviews, isLoading } = useQuery({
    queryKey: ['staff', 'interviews', activeParams],
    queryFn: async () => (await api.get('/api/staff/interviews', { params: activeParams })).data.data,
  })

  const columns = [
    { accessorKey: 'jobseeker_name', header: 'Jobseeker' },
    { accessorKey: 'company_name', header: 'Employer' },
    { accessorKey: 'job_title', header: 'Position' },
    { accessorKey: 'scheduled_date', header: 'Date', cell: ({ row }) => dayjs(row.original.scheduled_date).format('MMM D, YYYY h:mm A') },
    { accessorKey: 'mode', header: 'Mode' },
    {
      id: 'venue',
      header: 'Venue / Link',
      cell: ({ row }) => <span className="block max-w-[200px] truncate">{row.original.meeting_link || row.original.location || '—'}</span>,
    },
    { accessorKey: 'result', header: 'Result', cell: ({ row }) => <span className="capitalize">{row.original.result}</span> },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
  ]

  const exportReport = async (format) => {
    setExporting(true)
    try {
      await downloadFile('/api/staff/interviews/report', {
        params: { ...activeParams, format },
        filename: format === 'pdf' ? 'interview_report.pdf' : 'interview_report.xlsx',
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
        title="Interview Oversight"
        description="System-wide view of all interview activity across employers."
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

      <Card>
        <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <div>
            <Label>Status</Label>
            <Select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
              <option value="">All statuses</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s} className="capitalize">
                  {s}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Employer</Label>
            <Input placeholder="Company name" value={filters.employer} onChange={(e) => setFilters({ ...filters, employer: e.target.value })} />
          </div>
          <div>
            <Label>Municipality</Label>
            <Input
              placeholder="e.g. Pila"
              value={filters.municipality}
              onChange={(e) => setFilters({ ...filters, municipality: e.target.value })}
            />
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
        data={interviews}
        isLoading={isLoading}
        searchPlaceholder="Search interviews…"
        emptyTitle="No interviews match the current filters"
      />
    </motion.div>
  )
}
