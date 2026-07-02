import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Eye } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Button } from '../../components/ui/Button'
import { DataTable } from '../../components/ui/DataTable'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatusBadge } from '../../components/ui/StatusBadge'
import api from '../../lib/axios'
import { fadeIn } from '../../lib/motion'

export default function StaffVacancies({ basePath = '/staff' }) {
  const { data: vacancies, isLoading } = useQuery({
    queryKey: ['staff', 'vacancies'],
    queryFn: async () => (await api.get('/api/staff/vacancies')).data.data,
  })

  const columns = [
    { accessorKey: 'title', header: 'Job Title' },
    { accessorKey: 'company_name', header: 'Employer' },
    { accessorKey: 'job_type', header: 'Type' },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <Button size="sm" variant="secondary" asChild>
          <Link to={`${basePath}/vacancies/${row.original.id}`}>
            <Eye className="h-3.5 w-3.5" /> Review
          </Link>
        </Button>
      ),
    },
  ]

  return (
    <motion.div {...fadeIn}>
      <PageHeader title="Job Vacancy Management" description="Review and approve all job postings before they go public." />
      <DataTable columns={columns} data={vacancies} isLoading={isLoading} searchPlaceholder="Search vacancies…" emptyTitle="No vacancies submitted yet" />
    </motion.div>
  )
}
