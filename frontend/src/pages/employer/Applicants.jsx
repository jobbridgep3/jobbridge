import { useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { motion } from 'framer-motion'
import { Download, Eye, FileDown } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { Link } from 'react-router-dom'

import { Badge } from '../../components/ui/Badge'
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
import { fadeIn } from '../../lib/motion'

const STATUS_OPTIONS = [
  { value: 'applied', label: 'Application Submitted' },
  { value: 'under_review', label: 'Documents Under Review' },
  { value: 'shortlisted', label: 'Shortlisted' },
  { value: 'interview_scheduled', label: 'Interview Scheduled' },
  { value: 'interview_completed', label: 'Interview Completed' },
  { value: 'background_verification', label: 'Background Verification' },
  { value: 'offer_extended', label: 'Job Offer' },
  { value: 'hired', label: 'Hired' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Withdrawn' },
]

const EMPTY_FILTERS = { status: '', position: '', skill: '', education: '', municipality: '', min_match: '', date_from: '', date_to: '' }

export default function EmployerApplicants() {
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [exporting, setExporting] = useState(false)

  const activeParams = Object.fromEntries(Object.entries(filters).filter(([, v]) => v))

  const { data: applicants, isLoading } = useQuery({
    queryKey: ['applicants', activeParams],
    queryFn: async () => (await api.get('/api/applicants', { params: activeParams })).data.data,
  })

  useSocket({ 'application:new': () => queryClient.invalidateQueries({ queryKey: ['applicants'] }) })

  const columns = [
    { accessorKey: 'jobseeker_name', header: 'Applicant' },
    { accessorKey: 'job_title', header: 'Position' },
    {
      accessorKey: 'created_at',
      header: 'Date Applied',
      cell: ({ row }) => dayjs(row.original.created_at).format('MMM D, YYYY'),
    },
    { accessorKey: 'match_score', header: 'AI Match', cell: ({ row }) => <Badge variant="primary">{row.original.match_score ?? 0}%</Badge> },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status} label={row.original.status_label} />,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <Button size="sm" variant="secondary" asChild>
          <Link to={`/employer/applicants/${row.original.id}`}>
            <Eye className="h-3.5 w-3.5" /> View
          </Link>
        </Button>
      ),
    },
  ]

  const exportApplicants = async (format) => {
    setExporting(true)
    try {
      await downloadFile('/api/applicants/export', {
        params: { ...activeParams, format },
        filename: format === 'pdf' ? 'applicants.pdf' : 'applicants.xlsx',
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
        title="Applicant Management"
        description="View, filter, and process jobseekers who applied to your vacancies."
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => exportApplicants('excel')} disabled={exporting}>
              <Download className="h-4 w-4" /> Excel
            </Button>
            <Button variant="secondary" size="sm" onClick={() => exportApplicants('pdf')} disabled={exporting}>
              <FileDown className="h-4 w-4" /> PDF
            </Button>
          </div>
        }
      />

      <Card>
        <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-4">
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
            <Label>Position</Label>
            <Input placeholder="Job title" value={filters.position} onChange={(e) => setFilters({ ...filters, position: e.target.value })} />
          </div>
          <div>
            <Label>Skill</Label>
            <Input placeholder="e.g. carpentry" value={filters.skill} onChange={(e) => setFilters({ ...filters, skill: e.target.value })} />
          </div>
          <div>
            <Label>Education</Label>
            <Input
              placeholder="e.g. College"
              value={filters.education}
              onChange={(e) => setFilters({ ...filters, education: e.target.value })}
            />
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
            <Label>Min AI Match %</Label>
            <Input
              type="number"
              min="0"
              max="100"
              placeholder="e.g. 50"
              value={filters.min_match}
              onChange={(e) => setFilters({ ...filters, min_match: e.target.value })}
            />
          </div>
          <div>
            <Label>Applied From</Label>
            <DatePicker value={filters.date_from} onChange={(date) => setFilters({ ...filters, date_from: date })} />
          </div>
          <div>
            <Label>Applied To</Label>
            <DatePicker value={filters.date_to} onChange={(date) => setFilters({ ...filters, date_to: date })} />
          </div>
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        data={applicants}
        isLoading={isLoading}
        searchPlaceholder="Search applicants…"
        emptyTitle="No applicants match the current filters"
      />
    </motion.div>
  )
}
