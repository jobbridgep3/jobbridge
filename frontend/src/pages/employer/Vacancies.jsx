import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Eye, Plus, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { Link } from 'react-router-dom'

import { Button } from '../../components/ui/Button'
import { DataTable } from '../../components/ui/DataTable'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { fadeIn } from '../../lib/motion'
import api from '../../lib/axios'

export default function EmployerVacancies() {
  const queryClient = useQueryClient()
  const { data: vacancies, isLoading } = useQuery({
    queryKey: ['vacancies', 'my'],
    queryFn: async () => (await api.get('/api/vacancies/my')).data.data,
  })

  const closeMutation = useMutation({
    mutationFn: (id) => api.delete(`/api/vacancies/${id}`),
    onSuccess: () => {
      toast.success('Vacancy closed.')
      queryClient.invalidateQueries({ queryKey: ['vacancies', 'my'] })
    },
  })

  const columns = [
    { accessorKey: 'title', header: 'Job Title' },
    { accessorKey: 'job_type', header: 'Type' },
    { accessorKey: 'num_slots', header: 'Slots' },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="secondary" asChild>
            <Link to={`/employer/vacancies/${row.original.id}/edit`}>
              <Eye className="h-3.5 w-3.5" /> View / Edit
            </Link>
          </Button>
          {row.original.status !== 'closed' && (
            <Button size="sm" variant="ghost" onClick={() => closeMutation.mutate(row.original.id)}>
              <XCircle className="h-3.5 w-3.5" /> Close
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <motion.div {...fadeIn}>
      <PageHeader
        title="Vacancy Management"
        description="Create and manage all your job postings."
        actions={
          <Button asChild>
            <Link to="/employer/vacancies/create">
              <Plus className="h-4 w-4" /> Post Vacancy
            </Link>
          </Button>
        }
      />
      <DataTable
        columns={columns}
        data={vacancies}
        isLoading={isLoading}
        searchPlaceholder="Search vacancies…"
        emptyTitle="No vacancies posted yet"
        emptyDescription="Post your first vacancy to start receiving applicants."
      />
    </motion.div>
  )
}
