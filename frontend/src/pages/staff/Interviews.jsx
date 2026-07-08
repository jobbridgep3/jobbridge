import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { motion } from 'framer-motion'
import { Download } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'

import { Button } from '../../components/ui/Button'
import { DataTable } from '../../components/ui/DataTable'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatusBadge } from '../../components/ui/StatusBadge'
import api from '../../lib/axios'
import { downloadFile, parseBlobError } from '../../lib/download'
import { fadeIn } from '../../lib/motion'

export default function StaffInterviews() {
  const [exporting, setExporting] = useState(false)
  const { data: interviews, isLoading } = useQuery({
    queryKey: ['staff', 'interviews'],
    queryFn: async () => (await api.get('/api/staff/interviews')).data.data,
  })

  const columns = [
    { accessorKey: 'jobseeker_name', header: 'Jobseeker' },
    { accessorKey: 'company_name', header: 'Employer' },
    { accessorKey: 'job_title', header: 'Position' },
    { accessorKey: 'scheduled_date', header: 'Date', cell: ({ row }) => dayjs(row.original.scheduled_date).format('MMM D, YYYY h:mm A') },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
  ]

  const exportReport = async () => {
    setExporting(true)
    try {
      await downloadFile('/api/staff/interviews/report', { filename: 'interview_report.xlsx' })
    } catch (err) {
      toast.error(await parseBlobError(err))
    } finally {
      setExporting(false)
    }
  }

  return (
    <motion.div {...fadeIn}>
      <PageHeader
        title="Interview Oversight"
        description="System-wide read-only view of all interview activities."
        actions={
          <Button variant="secondary" size="sm" onClick={exportReport} disabled={exporting}>
            <Download className="h-4 w-4" /> Export Report
          </Button>
        }
      />
      <DataTable columns={columns} data={interviews} isLoading={isLoading} searchPlaceholder="Search interviews…" emptyTitle="No interviews scheduled system-wide" />
    </motion.div>
  )
}
