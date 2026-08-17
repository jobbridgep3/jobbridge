import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Download } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

import { CalendarView } from '../../components/ui/CalendarView'
import { Button } from '../../components/ui/Button'
import { Card, CardContent } from '../../components/ui/Card'
import { DataTable } from '../../components/ui/DataTable'
import { DatePicker } from '../../components/ui/DatePicker'
import { Input, Label, Select } from '../../components/ui/Input'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { useSocket } from '../../hooks/useSocket'
import api from '../../lib/axios'
import { downloadFile, parseBlobError } from '../../lib/download'
import { manila } from '../../lib/manilaTime'
import { fadeIn } from '../../lib/motion'
import { cn } from '../../lib/utils'

const DILP_STATUSES = ['pending', 'scheduled', 'completed', 'no_show', 'ready_for_claiming', 'approved', 'submitted_to_esfo']

export default function StaffDILP() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [view, setView] = useState('list')
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [exporting, setExporting] = useState(null)

  const params = { status: status || undefined, search: search || undefined, date_from: dateFrom || undefined, date_to: dateTo || undefined }

  const { data: applications, isLoading } = useQuery({
    queryKey: ['staff', 'dilp', 'queue', params],
    queryFn: async () => (await api.get('/api/staff/dilp/queue', { params })).data.data,
    placeholderData: keepPreviousData,
  })

  // Calendar tab: unfiltered so an active status filter on the list tab never hides
  // interviews from the calendar. Cached independently by React Query.
  const { data: allApplications } = useQuery({
    queryKey: ['staff', 'dilp', 'queue', 'all'],
    queryFn: async () => (await api.get('/api/staff/dilp/queue')).data.data,
    enabled: view === 'calendar',
  })

  useSocket({ 'dilp:board_update': () => queryClient.invalidateQueries({ queryKey: ['staff', 'dilp'] }) })

  const handleExport = async (format) => {
    setExporting(format)
    try {
      await downloadFile(`/api/staff/dilp/export/${format}`, {
        params, filename: `dilp_report.${format === 'excel' ? 'xlsx' : 'pdf'}`,
      })
    } catch (err) {
      toast.error(await parseBlobError(err))
    } finally {
      setExporting(null)
    }
  }

  const calendarEvents = useMemo(
    () =>
      (allApplications || [])
        .filter((a) => a.interview_at)
        .map((a) => ({ id: a.id, date: a.interview_at, title: a.jobseeker_name, subtitle: a.proposed_livelihood, status: a.status })),
    [allApplications],
  )

  const columns = [
    { accessorKey: 'jobseeker_name', header: 'Applicant Name' },
    {
      accessorKey: 'created_at',
      header: 'Date Submitted',
      cell: ({ row }) => manila(row.original.created_at).format('MMM D, YYYY'),
    },
    { accessorKey: 'proposed_livelihood', header: 'Proposed Livelihood' },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    {
      id: 'interview_date',
      header: 'Interview Date',
      cell: ({ row }) => (row.original.interview_at ? manila(row.original.interview_at).format('MMM D, YYYY h:mm A') : '—'),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <Link to={`/staff/dilp/${row.original.id}`}>
          <Button size="sm" variant="secondary">View</Button>
        </Link>
      ),
    },
  ]

  return (
    <motion.div {...fadeIn} className="space-y-4">
      <PageHeader
        title="DILP Management"
        description="Review and process DOLE Integrated Livelihood Program applications."
        actions={
          <>
            <div className="flex rounded-lg border border-border p-0.5">
              {['list', 'calendar'].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-xs font-medium capitalize',
                    view === v ? 'bg-primary-800 text-white' : 'text-text-secondary hover:bg-surface-hover',
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
            <Button variant="secondary" size="sm" onClick={() => handleExport('excel')} disabled={exporting === 'excel'}>
              <Download className="h-4 w-4" /> {exporting === 'excel' ? 'Exporting…' : 'Export Excel'}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => handleExport('pdf')} disabled={exporting === 'pdf'}>
              <Download className="h-4 w-4" /> {exporting === 'pdf' ? 'Exporting…' : 'Export PDF'}
            </Button>
          </>
        }
      />

      {view === 'list' && (
        <>
          <Card>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <Label>Status</Label>
                <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="">All Statuses</option>
                  {DILP_STATUSES.map((s) => (
                    <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Search Applicant</Label>
                <Input placeholder="Search by name…" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <div>
                <Label>Date From</Label>
                <DatePicker value={dateFrom} onChange={setDateFrom} maxDate={dateTo} />
              </div>
              <div>
                <Label>Date To</Label>
                <DatePicker value={dateTo} onChange={setDateTo} minDate={dateFrom} />
              </div>
            </CardContent>
          </Card>

          <DataTable
            columns={columns}
            data={applications}
            isLoading={isLoading}
            searchPlaceholder="Refine current results…"
            emptyTitle="No DILP applications match these filters"
          />
        </>
      )}

      {view === 'calendar' && (
        <CalendarView events={calendarEvents} onEventClick={(e) => navigate(`/staff/dilp/${e.id}`)} initialView="week" />
      )}
    </motion.div>
  )
}
