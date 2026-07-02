import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { motion } from 'framer-motion'

import { DataTable } from '../../components/ui/DataTable'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatusBadge } from '../../components/ui/StatusBadge'
import api from '../../lib/axios'
import { fadeIn } from '../../lib/motion'

export default function EmployerInterviews() {
  const { data: interviews, isLoading } = useQuery({
    queryKey: ['interviews', 'my'],
    queryFn: async () => (await api.get('/api/interviews/my')).data.data,
  })

  const columns = [
    { accessorKey: 'jobseeker_name', header: 'Applicant' },
    { accessorKey: 'job_title', header: 'Position' },
    { accessorKey: 'scheduled_date', header: 'Date', cell: ({ row }) => dayjs(row.original.scheduled_date).format('MMM D, YYYY h:mm A') },
    { accessorKey: 'mode', header: 'Mode' },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
  ]

  return (
    <motion.div {...fadeIn}>
      <PageHeader title="Interview Management" description="Schedule and track all interviews. Create invites from an applicant's detail page." />
      <DataTable columns={columns} data={interviews} isLoading={isLoading} searchPlaceholder="Search interviews…" emptyTitle="No interviews yet" emptyDescription="Schedule interviews from the Applicant Management page." />
    </motion.div>
  )
}
