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

export default function StaffEmployers({ basePath = '/staff' }) {
  const { data: employers, isLoading } = useQuery({
    queryKey: ['staff', 'employers'],
    queryFn: async () => (await api.get('/api/staff/employers')).data.data,
  })

  const columns = [
    { accessorKey: 'company_name', header: 'Company' },
    { accessorKey: 'hr_contact_name', header: 'HR Contact' },
    { accessorKey: 'industry', header: 'Industry' },
    { accessorKey: 'verification_status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.verification_status} /> },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <Button size="sm" variant="secondary" asChild>
          <Link to={`${basePath}/employers/${row.original.id}`}>
            <Eye className="h-3.5 w-3.5" /> View
          </Link>
        </Button>
      ),
    },
  ]

  return (
    <motion.div {...fadeIn}>
      <PageHeader title="Employer Management" description="View and verify all registered employer accounts." />
      <DataTable columns={columns} data={employers} isLoading={isLoading} searchPlaceholder="Search employers…" emptyTitle="No employers registered yet" />
    </motion.div>
  )
}
