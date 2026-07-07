import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Eye } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { DataTable } from '../../components/ui/DataTable'
import { PageHeader } from '../../components/ui/PageHeader'
import { ProgressBar } from '../../components/ui/ProgressBar'
import api from '../../lib/axios'
import { fadeIn } from '../../lib/motion'

export default function StaffJobseekers({ basePath = '/staff' }) {
  const { data: jobseekers, isLoading } = useQuery({
    queryKey: ['staff', 'jobseekers'],
    queryFn: async () => (await api.get('/api/staff/jobseekers')).data.data,
  })

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
      <PageHeader title="Jobseeker Management" description="View, verify, and manage all registered jobseekers." />
      <DataTable columns={columns} data={jobseekers} isLoading={isLoading} searchPlaceholder="Search jobseekers…" emptyTitle="No jobseekers registered yet" />
    </motion.div>
  )
}
