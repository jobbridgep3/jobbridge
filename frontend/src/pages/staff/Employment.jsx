import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Download } from 'lucide-react'

import { Button } from '../../components/ui/Button'
import { DataTable } from '../../components/ui/DataTable'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatusBadge } from '../../components/ui/StatusBadge'
import api from '../../lib/axios'
import { fadeIn } from '../../lib/motion'

export default function StaffEmployment() {
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

  return (
    <motion.div {...fadeIn}>
      <PageHeader
        title="Employment Monitoring"
        description="System-wide employment tracking — primary source for LMI data."
        actions={
          <Button variant="secondary" size="sm" onClick={() => window.open(`${api.defaults.baseURL}/api/staff/employment/report?format=excel`, '_blank')}>
            <Download className="h-4 w-4" /> Export Report
          </Button>
        }
      />
      <DataTable columns={columns} data={records} isLoading={isLoading} searchPlaceholder="Search employment records…" emptyTitle="No employment records yet" />
    </motion.div>
  )
}
