import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Eye } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { DataTable } from '../../components/ui/DataTable'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { useSocket } from '../../hooks/useSocket'
import api from '../../lib/axios'
import { fadeIn } from '../../lib/motion'

export default function EmployerApplicants() {
  const queryClient = useQueryClient()
  const { data: applicants, isLoading } = useQuery({
    queryKey: ['applicants'],
    queryFn: async () => (await api.get('/api/applicants')).data.data,
  })

  useSocket({ 'application:new': () => queryClient.invalidateQueries({ queryKey: ['applicants'] }) })

  const columns = [
    { accessorKey: 'jobseeker_name', header: 'Applicant' },
    { accessorKey: 'job_title', header: 'Position' },
    { accessorKey: 'match_score', header: 'AI Match', cell: ({ row }) => <Badge variant="primary">{row.original.match_score ?? 0}%</Badge> },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
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

  return (
    <motion.div {...fadeIn}>
      <PageHeader title="Applicant Management" description="View and process jobseekers who applied to your vacancies." />
      <DataTable columns={columns} data={applicants} isLoading={isLoading} searchPlaceholder="Search applicants…" emptyTitle="No applicants yet" />
    </motion.div>
  )
}
