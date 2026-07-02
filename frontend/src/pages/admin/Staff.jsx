import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { KeyRound, Plus, UserX } from 'lucide-react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'

import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { DataTable } from '../../components/ui/DataTable'
import { PageHeader } from '../../components/ui/PageHeader'
import api from '../../lib/axios'
import { fadeIn } from '../../lib/motion'

export default function AdminStaff() {
  const queryClient = useQueryClient()
  const { data: staff, isLoading } = useQuery({
    queryKey: ['admin', 'staff'],
    queryFn: async () => (await api.get('/api/admin/staff')).data.data,
  })

  const toggleActive = useMutation({
    mutationFn: (id) => api.put(`/api/admin/staff/${id}/deactivate`),
    onSuccess: () => {
      toast.success('Staff account updated.')
      queryClient.invalidateQueries({ queryKey: ['admin', 'staff'] })
    },
  })

  const resetPassword = useMutation({
    mutationFn: (id) => api.put(`/api/admin/staff/${id}`, { reset_password: true }),
    onSuccess: () => {
      toast.success('New temporary password emailed to staff member.')
      queryClient.invalidateQueries({ queryKey: ['admin', 'staff'] })
    },
  })

  const columns = [
    { accessorKey: 'email', header: 'Email' },
    { accessorKey: 'actions_count', header: 'Actions Logged' },
    {
      accessorKey: 'is_active',
      header: 'Status',
      cell: ({ row }) => <Badge variant={row.original.is_active ? 'success' : 'danger'}>{row.original.is_active ? 'Active' : 'Inactive'}</Badge>,
    },
    { accessorKey: 'last_login_at', header: 'Last Login', cell: ({ row }) => (row.original.last_login_at ? new Date(row.original.last_login_at).toLocaleString() : 'Never') },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="secondary" onClick={() => resetPassword.mutate(row.original.id)}>
            <KeyRound className="h-3.5 w-3.5" /> Reset Password
          </Button>
          <Button size="sm" variant="ghost" onClick={() => toggleActive.mutate(row.original.id)}>
            <UserX className="h-3.5 w-3.5" /> {row.original.is_active ? 'Deactivate' : 'Reactivate'}
          </Button>
        </div>
      ),
    },
  ]

  return (
    <motion.div {...fadeIn}>
      <PageHeader
        title="Staff Management"
        description="The only way PESO Staff accounts are created — no self-registration exists."
        actions={
          <Button asChild>
            <Link to="/admin/staff/create">
              <Plus className="h-4 w-4" /> Create Staff Account
            </Link>
          </Button>
        }
      />
      <DataTable columns={columns} data={staff} isLoading={isLoading} searchPlaceholder="Search staff…" emptyTitle="No PESO Staff accounts yet" />
    </motion.div>
  )
}
