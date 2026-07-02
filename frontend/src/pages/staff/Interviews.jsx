import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { motion } from 'framer-motion'
import { Download } from 'lucide-react'

import { Button } from '../../components/ui/Button'
import { DataTable } from '../../components/ui/DataTable'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatusBadge } from '../../components/ui/StatusBadge'
import api from '../../lib/axios'
import { fadeIn } from '../../lib/motion'

export default function StaffInterviews() {
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

  return (
    <motion.div {...fadeIn}>
      <PageHeader
        title="Interview Oversight"
        description="System-wide read-only view of all interview activities."
        actions={
          <Button variant="secondary" size="sm" onClick={() => window.open(`${api.defaults.baseURL}/api/staff/interviews/report`, '_blank')}>
            <Download className="h-4 w-4" /> Export Report
          </Button>
        }
      />
      <DataTable columns={columns} data={interviews} isLoading={isLoading} searchPlaceholder="Search interviews…" emptyTitle="No interviews scheduled system-wide" />
    </motion.div>
  )
}
