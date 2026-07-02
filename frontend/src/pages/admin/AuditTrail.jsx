import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Download } from 'lucide-react'
import { useState } from 'react'

import { Button } from '../../components/ui/Button'
import { DataTable } from '../../components/ui/DataTable'
import { Badge } from '../../components/ui/Badge'
import { Select } from '../../components/ui/Input'
import { PageHeader } from '../../components/ui/PageHeader'
import api from '../../lib/axios'
import { fadeIn } from '../../lib/motion'

export default function AdminAuditTrail() {
  const [roleFilter, setRoleFilter] = useState('')

  const { data: entries, isLoading } = useQuery({
    queryKey: ['admin', 'audit', roleFilter],
    queryFn: async () => (await api.get('/api/admin/audit', { params: roleFilter ? { user_role: roleFilter } : {} })).data.data,
  })

  const columns = [
    { accessorKey: 'created_at', header: 'Timestamp', cell: ({ row }) => new Date(row.original.created_at).toLocaleString() },
    { accessorKey: 'user_email', header: 'User' },
    { accessorKey: 'user_role', header: 'Role', cell: ({ row }) => <Badge className="capitalize">{row.original.user_role}</Badge> },
    { accessorKey: 'action', header: 'Action' },
    { accessorKey: 'module', header: 'Module' },
    { accessorKey: 'ip_address', header: 'IP Address' },
  ]

  return (
    <motion.div {...fadeIn} className="space-y-4">
      <PageHeader
        title="Audit Trail"
        description="Complete immutable log of every significant action across all roles."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => window.open(`${api.defaults.baseURL}/api/admin/audit/export/excel`, '_blank')}>
              <Download className="h-4 w-4" /> Excel
            </Button>
            <Button variant="secondary" size="sm" onClick={() => window.open(`${api.defaults.baseURL}/api/admin/audit/export/pdf`, '_blank')}>
              <Download className="h-4 w-4" /> PDF
            </Button>
          </>
        }
      />
      <div className="max-w-xs">
        <Select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="">All Roles</option>
          <option value="jobseeker">Jobseeker</option>
          <option value="employer">Employer</option>
          <option value="staff">PESO Staff</option>
          <option value="admin">Admin</option>
        </Select>
      </div>
      <DataTable columns={columns} data={entries} isLoading={isLoading} searchPlaceholder="Search audit log…" emptyTitle="No audit entries yet" pageSize={20} />
    </motion.div>
  )
}
