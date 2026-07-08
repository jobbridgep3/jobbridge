import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { KeyRound, Plus, UserX } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'

import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { DataTable } from '../../components/ui/DataTable'
import { PageHeader } from '../../components/ui/PageHeader'
import api from '../../lib/axios'
import { fadeIn } from '../../lib/motion'

export default function AdminStaff() {
  const queryClient = useQueryClient()
  const [confirmTarget, setConfirmTarget] = useState(null) // { type: 'toggle' | 'reset', row }
  const { data: staff, isLoading } = useQuery({
    queryKey: ['admin', 'staff'],
    queryFn: async () => (await api.get('/api/admin/staff')).data.data,
  })

  const toggleActive = useMutation({
    mutationFn: (id) => api.put(`/api/admin/staff/${id}/deactivate`),
    onSuccess: () => {
      toast.success('Staff account updated.')
      setConfirmTarget(null)
      queryClient.invalidateQueries({ queryKey: ['admin', 'staff'] })
    },
  })

  const resetPassword = useMutation({
    mutationFn: (id) => api.put(`/api/admin/staff/${id}`, { reset_password: true }),
    onSuccess: () => {
      toast.success('New temporary password emailed to staff member.')
      setConfirmTarget(null)
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
          <Button size="sm" variant="secondary" onClick={() => setConfirmTarget({ type: 'reset', row: row.original })}>
            <KeyRound className="h-3.5 w-3.5" /> Reset Password
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirmTarget({ type: 'toggle', row: row.original })}>
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

      <ConfirmDialog
        open={confirmTarget !== null}
        onOpenChange={(open) => !open && setConfirmTarget(null)}
        title={
          confirmTarget?.type === 'reset'
            ? 'Reset this staff member’s password?'
            : confirmTarget?.row.is_active
              ? 'Deactivate this staff account?'
              : 'Reactivate this staff account?'
        }
        description={
          confirmTarget?.type === 'reset'
            ? 'A new temporary password will be generated and emailed to them.'
            : confirmTarget?.row.is_active
              ? 'They will immediately lose the ability to log in.'
              : 'They will be able to log in again.'
        }
        confirmLabel={confirmTarget?.type === 'reset' ? 'Reset Password' : confirmTarget?.row.is_active ? 'Deactivate' : 'Reactivate'}
        danger={confirmTarget?.type === 'toggle' && confirmTarget?.row.is_active}
        onConfirm={() =>
          confirmTarget?.type === 'reset' ? resetPassword.mutate(confirmTarget.row.id) : toggleActive.mutate(confirmTarget.row.id)
        }
        loading={resetPassword.isPending || toggleActive.isPending}
      />
    </motion.div>
  )
}
