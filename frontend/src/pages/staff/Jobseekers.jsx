import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Download, Eye } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { Link } from 'react-router-dom'

import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { DataTable } from '../../components/ui/DataTable'
import { DatePicker } from '../../components/ui/DatePicker'
import { Dialog, DialogContent } from '../../components/ui/Dialog'
import { Input, Label, Select } from '../../components/ui/Input'
import { PageHeader } from '../../components/ui/PageHeader'
import { ProgressBar } from '../../components/ui/ProgressBar'
import api from '../../lib/axios'
import { downloadFile, parseBlobError } from '../../lib/download'
import { fadeIn } from '../../lib/motion'

const EMPTY_FILTERS = {
  date_from: '', date_to: '', verification_status: '', is_active: '', barangay: '', municipality: '', employment_status: '',
}

export default function StaffJobseekers({ basePath = '/staff' }) {
  const { data: jobseekers, isLoading } = useQuery({
    queryKey: ['staff', 'jobseekers'],
    queryFn: async () => (await api.get('/api/staff/jobseekers')).data.data,
  })

  const [exportOpen, setExportOpen] = useState(false)
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [exporting, setExporting] = useState(null)

  const setFilter = (field) => (e) => setFilters((f) => ({ ...f, [field]: e.target.value }))
  const setFilterValue = (field) => (value) => setFilters((f) => ({ ...f, [field]: value }))

  const handleExport = async (format) => {
    setExporting(format)
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== ''))
      await downloadFile(`/api/staff/jobseekers/export/${format}`, {
        params,
        filename: `jobseekers_export.${format === 'excel' ? 'xlsx' : 'pdf'}`,
      })
      toast.success('Export downloaded.')
      setExportOpen(false)
    } catch (err) {
      toast.error(await parseBlobError(err))
    } finally {
      setExporting(null)
    }
  }

  const columns = [
    { accessorKey: 'full_name', header: 'Full Name' },
    { accessorKey: 'contact_number', header: 'Contact' },
    {
      accessorKey: 'profile_completion',
      header: 'Profile %',
      cell: ({ row }) => <ProgressBar percent={row.original.profile_completion} compact className="w-24" />,
    },
    {
      accessorKey: 'is_verified_by_staff',
      header: 'Verified',
      cell: ({ row }) => <Badge variant={row.original.is_verified_by_staff ? 'success' : 'default'}>{row.original.is_verified_by_staff ? 'Verified' : 'Unverified'}</Badge>,
    },
    {
      accessorKey: 'is_active',
      header: 'Status',
      cell: ({ row }) => <Badge variant={row.original.is_active ? 'success' : 'danger'}>{row.original.is_active ? 'Active' : 'Inactive'}</Badge>,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <Button size="sm" variant="secondary" asChild>
          <Link to={`${basePath}/jobseekers/${row.original.id}`}>
            <Eye className="h-3.5 w-3.5" /> View
          </Link>
        </Button>
      ),
    },
  ]

  return (
    <motion.div {...fadeIn}>
      <PageHeader
        title="Jobseeker Management"
        description="View, verify, and manage all registered jobseekers."
        actions={
          <Button variant="secondary" size="sm" onClick={() => setExportOpen(true)}>
            <Download className="h-4 w-4" /> Export All Job Seekers
          </Button>
        }
      />
      <DataTable columns={columns} data={jobseekers} isLoading={isLoading} searchPlaceholder="Search jobseekers…" emptyTitle="No jobseekers registered yet" />

      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent title="Export Job Seekers" description="Optionally filter before exporting to Excel. Leave a field blank to include all.">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label>Date Registered — From</Label>
              <DatePicker value={filters.date_from} onChange={setFilterValue('date_from')} maxDate={filters.date_to} />
            </div>
            <div>
              <Label>Date Registered — To</Label>
              <DatePicker value={filters.date_to} onChange={setFilterValue('date_to')} minDate={filters.date_from} />
            </div>
            <div>
              <Label>Verification Status</Label>
              <Select value={filters.verification_status} onChange={setFilter('verification_status')}>
                <option value="">All</option>
                <option value="verified">Verified</option>
                <option value="unverified">Unverified</option>
              </Select>
            </div>
            <div>
              <Label>Active/Inactive Status</Label>
              <Select value={filters.is_active} onChange={setFilter('is_active')}>
                <option value="">All</option>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </Select>
            </div>
            <div>
              <Label>Barangay</Label>
              <Input value={filters.barangay} onChange={setFilter('barangay')} placeholder="e.g. Poblacion" />
            </div>
            <div>
              <Label>Municipality</Label>
              <Input value={filters.municipality} onChange={setFilter('municipality')} placeholder="e.g. Pila" />
            </div>
            <div className="sm:col-span-2">
              <Label>Employment Status</Label>
              <Input value={filters.employment_status} onChange={setFilter('employment_status')} placeholder="e.g. Unemployed" />
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setFilters(EMPTY_FILTERS)} disabled={exporting !== null}>
              Clear Filters
            </Button>
            <Button variant="secondary" size="sm" onClick={() => handleExport('excel')} disabled={exporting !== null}>
              {exporting === 'excel' ? 'Exporting…' : 'Export to Excel'}
            </Button>
            <Button size="sm" onClick={() => handleExport('pdf')} disabled={exporting !== null}>
              {exporting === 'pdf' ? 'Exporting…' : 'Export to PDF'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
