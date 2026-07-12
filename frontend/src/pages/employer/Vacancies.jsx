import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Copy, Eye, FileText, Plus } from 'lucide-react'
import { useMemo } from 'react'
import toast from 'react-hot-toast'
import { Link, useSearchParams } from 'react-router-dom'

import { Button } from '../../components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { DataTable } from '../../components/ui/DataTable'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatusBadge } from '../../components/ui/StatusBadge'
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
  const { data: templates } = useQuery({
    queryKey: ['vacancies', 'templates'],
    queryFn: async () => (await api.get('/api/vacancies/templates')).data.data,
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

  const useTemplate = useMutation({
    mutationFn: (id) => api.post(`/api/vacancies/${id}/duplicate`),
    onSuccess: (res) => {
      toast.success('New draft created from template.')
      queryClient.invalidateQueries({ queryKey: ['vacancies', 'my'] })
      window.location.href = `/employer/vacancies/${res.data.data.id}/edit`
    },
    onError: (err) => toast.error(formatApiError(err, 'Could not use template.')),
  })

  const columns = [
    { accessorKey: 'title', header: 'Job Title' },
    { accessorKey: 'job_type', header: 'Type', cell: ({ row }) => row.original.job_type?.replace(/_/g, ' ') || '—' },
    { accessorKey: 'num_slots', header: 'Openings' },
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

      {templates?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary-600" /> Saved Templates
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            {templates.map((t) => (
              <Button key={t.id} size="sm" variant="secondary" onClick={() => useTemplate.mutate(t.id)} disabled={useTemplate.isPending}>
                <Copy className="h-3.5 w-3.5" /> {t.template_name || t.title}
              </Button>
            ))}
          </CardContent>
        </Card>
      )}

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
