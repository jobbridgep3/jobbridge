import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Eye, Plus } from 'lucide-react'
import { useMemo } from 'react'
import toast from 'react-hot-toast'
import { Link, useSearchParams } from 'react-router-dom'

import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { DataTable } from '../../components/ui/DataTable'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { useSocket } from '../../hooks/useSocket'
import { fadeIn } from '../../lib/motion'
import api from '../../lib/axios'
import { formatApiError } from '../../lib/utils'
import { canTransition } from '../../lib/vacancyStateMachine'

export default function EmployerVacancies() {
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const statusFilter = searchParams.get('status')

  const { data: vacancies, isLoading } = useQuery({
    queryKey: ['vacancies', 'my'],
    queryFn: async () => (await api.get('/api/vacancies/my')).data.data,
  })

  // Live-refresh remaining slots / Full state (e.g. after a hire or a
  // resignation) without requiring a manual page reload.
  useSocket({
    'public:homepage_update': (payload) => {
      if (payload?.sections?.includes('jobs')) queryClient.invalidateQueries({ queryKey: ['vacancies', 'my'] })
    },
  })

  const filtered = useMemo(
    () => (statusFilter ? (vacancies || []).filter((v) => v.status === statusFilter) : vacancies),
    [vacancies, statusFilter]
  )

  const runAction = useMutation({
    mutationFn: ({ id, action }) => api.post(`/api/vacancies/${id}/${action}`),
    onSuccess: (res) => {
      toast.success(res.data.message)
      queryClient.invalidateQueries({ queryKey: ['vacancies', 'my'] })
    },
    onError: (err) => toast.error(formatApiError(err, 'Could not update vacancy.')),
  })

  const columns = [
    { accessorKey: 'title', header: 'Job Title' },
    { accessorKey: 'job_type', header: 'Type', cell: ({ row }) => row.original.job_type?.replace(/_/g, ' ') || '—' },
    {
      accessorKey: 'num_slots',
      header: 'Openings',
      cell: ({ row }) => {
        const v = row.original
        return (
          <span className="inline-flex items-center gap-2">
            {v.occupied_slots != null ? `${v.occupied_slots} / ${v.num_slots} occupied` : v.num_slots}
            {v.is_full && <Badge variant="danger">Full</Badge>}
          </span>
        )
      },
    },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const v = row.original
        return (
          <div className="flex flex-wrap justify-end gap-2">
            <Button size="sm" variant="secondary" asChild>
              <Link to={`/employer/vacancies/${v.id}/edit`}>
                <Eye className="h-3.5 w-3.5" /> View / Edit
              </Link>
            </Button>
            {canTransition(v.status, 'closed', 'employer') && (
              <Button size="sm" variant="ghost" onClick={() => runAction.mutate({ id: v.id, action: 'close' })}>
                Close
              </Button>
            )}
            {canTransition(v.status, 'published', 'employer') && v.status === 'closed' && (
              <Button size="sm" variant="ghost" onClick={() => runAction.mutate({ id: v.id, action: 'reopen' })}>
                Reopen
              </Button>
            )}
          </div>
        )
      },
    },
  ]

  return (
    <motion.div {...fadeIn} className="space-y-6">
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
        data={filtered}
        isLoading={isLoading}
        searchPlaceholder="Search vacancies…"
        emptyTitle="No vacancies posted yet"
        emptyDescription="Post your first vacancy to start receiving applicants."
      />
    </motion.div>
  )
}
