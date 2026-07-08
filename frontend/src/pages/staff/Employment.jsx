import { useQuery } from '@tanstack/react-query'
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

export default function StaffEmployment() {
  const [exporting, setExporting] = useState(false)
  const { data: records, isLoading } = useQuery({
    queryKey: ['staff', 'employment'],
    queryFn: async () => (await api.get('/api/staff/employment')).data.data,
  })

  const columns = [
    { accessorKey: 'jobseeker_name', header: 'Jobseeker' },
    { accessorKey: 'employer_name', header: 'Employer' },
    { accessorKey: 'position', header: 'Position' },
    { accessorKey: 'start_date', header: 'Start Date' },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
  ]

  const exportReport = async () => {
    setExporting(true)
    try {
      await downloadFile('/api/staff/employment/report', { params: { format: 'excel' }, filename: 'employment_report.xlsx' })
    } catch (err) {
      toast.error(await parseBlobError(err))
    } finally {
      setExporting(false)
    }
  }

  return (
    <motion.div {...fadeIn}>
      <PageHeader
        title="Employment Monitoring"
        description="System-wide employment tracking — primary source for LMI data."
        actions={
          <Button variant="secondary" size="sm" onClick={exportReport} disabled={exporting}>
            <Download className="h-4 w-4" /> Export Report
          </Button>
        }
      />
      <DataTable columns={columns} data={records} isLoading={isLoading} searchPlaceholder="Search employment records…" emptyTitle="No employment records yet" />
    </motion.div>
  )
}
