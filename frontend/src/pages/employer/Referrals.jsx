import { useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { motion } from 'framer-motion'
import { CheckCircle2, ClipboardList, Eye, Send, UserPlus, XCircle } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { Button } from '../../components/ui/Button'
import { Card, CardContent } from '../../components/ui/Card'
import { DataTable } from '../../components/ui/DataTable'
import { Input, Label, Select } from '../../components/ui/Input'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatCard } from '../../components/ui/StatCard'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { useSocket } from '../../hooks/useSocket'
import api from '../../lib/axios'
import { fadeIn, staggerContainer, staggerItem } from '../../lib/motion'

export default function EmployerReferrals() {
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState({ status: '', q: '' })

  const activeParams = Object.fromEntries(Object.entries(filters).filter(([, v]) => v))

  const { data: stats } = useQuery({
    queryKey: ['employer', 'referrals', 'summary'],
    queryFn: async () => (await api.get('/api/employer/referrals/summary')).data.data,
  })

  const { data: referrals, isLoading } = useQuery({
    queryKey: ['employer', 'referrals', activeParams],
    queryFn: async () => (await api.get('/api/employer/referrals', { params: activeParams })).data.data,
  })

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['employer', 'referrals'] })
  useSocket({ 'referral:employer_pending': refresh })

  const cards = [
    { label: 'Total Referrals', value: stats?.total ?? '–', icon: Send, tone: 'primary' },
    { label: 'Pending Review', value: stats?.pending ?? '–', icon: ClipboardList, tone: 'warning' },
    { label: 'Accepted', value: stats?.accepted ?? '–', icon: CheckCircle2, tone: 'success' },
    { label: 'Rejected', value: stats?.rejected ?? '–', icon: XCircle, tone: 'danger' },
    { label: 'Converted to Applicants', value: stats?.converted ?? '–', icon: UserPlus, tone: 'success' },
  ]

  const columns = [
    { accessorKey: 'referral_number', header: 'Referral No.', cell: ({ row }) => row.original.referral_number || '—' },
    { accessorKey: 'jobseeker_name', header: 'Jobseeker' },
    { accessorKey: 'job_title', header: 'Vacancy' },
    { accessorKey: 'created_at', header: 'Referral Date', cell: ({ row }) => dayjs(row.original.created_at).format('MMM D, YYYY') },
    { accessorKey: 'employer_status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.employer_status} /> },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <Button size="sm" variant="secondary" asChild>
          <Link to={`/employer/referrals/${row.original.id}`}>
            <Eye className="h-3.5 w-3.5" /> View
          </Link>
        </Button>
      ),
    },
  ]

  return (
    <motion.div {...fadeIn} className="space-y-4">
      <PageHeader
        title="Referral Management"
        description="PESO-forwarded candidate referrals for your vacancies — review, accept, or decline."
      />

      <motion.div variants={staggerContainer} initial="initial" animate="animate" className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((c) => (
          <motion.div key={c.label} variants={staggerItem}>
            <StatCard {...c} />
          </motion.div>
        ))}
      </motion.div>

      <Card>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <Label>Status</Label>
            <Select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
              <option value="">All statuses</option>
              <option value="pending">Pending Review</option>
              <option value="accepted">Accepted</option>
              <option value="rejected">Rejected</option>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label>Search</Label>
            <Input
              placeholder="Jobseeker name or referral number"
              value={filters.q}
              onChange={(e) => setFilters({ ...filters, q: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        data={referrals}
        isLoading={isLoading}
        searchPlaceholder="Search referrals…"
        emptyTitle="No referrals match the current filters"
        emptyDescription="PESO-approved referrals for your vacancies will appear here."
      />
    </motion.div>
  )
}
