import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'

import { Button } from '../../components/ui/Button'
import { DataTable } from '../../components/ui/DataTable'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatusBadge } from '../../components/ui/StatusBadge'
import api from '../../lib/axios'
import { fadeIn } from '../../lib/motion'

export default function EmployerEmployment() {
  const queryClient = useQueryClient()
  const { data: records, isLoading } = useQuery({
    queryKey: ['employment', 'my-hires'],
    queryFn: async () => (await api.get('/api/employment/my-hires')).data.data,
  })

  const updateStatus = useMutation({
    mutationFn: ({ id, status }) => api.put(`/api/employment/${id}/status`, { status }),
    onSuccess: () => {
      toast.success('Employment status updated.')
      queryClient.invalidateQueries({ queryKey: ['employment', 'my-hires'] })
    },
  })

  const columns = [
    { accessorKey: 'jobseeker_name', header: 'Employee' },
    { accessorKey: 'position', header: 'Position' },
    { accessorKey: 'start_date', header: 'Start Date' },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) =>
        row.original.status === 'active' && (
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="secondary" onClick={() => updateStatus.mutate({ id: row.original.id, status: 'completed' })}>
              Mark Completed
            </Button>
            <Button size="sm" variant="ghost" onClick={() => updateStatus.mutate({ id: row.original.id, status: 'terminated' })}>
              Terminate
            </Button>
          </div>
        ),
    },
  ]

  return (
    <motion.div {...fadeIn}>
      <PageHeader title="Employment Monitoring" description="Track all hired employees and update their employment status." />
      <DataTable columns={columns} data={records} isLoading={isLoading} searchPlaceholder="Search employees…" emptyTitle="No hired employees yet" />
    </motion.div>
  )
}
