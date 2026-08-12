import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { motion } from 'framer-motion'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { Button } from '../../components/ui/Button'
import { Card, CardContent } from '../../components/ui/Card'
import { DataTable } from '../../components/ui/DataTable'
import { DatePicker } from '../../components/ui/DatePicker'
import { Input, Label, Select } from '../../components/ui/Input'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { useSocket } from '../../hooks/useSocket'
import api from '../../lib/axios'
import { fadeIn } from '../../lib/motion'

const OWWA_STATUSES = ['pending', 'verified', 'submitted_to_owwa', 'for_owwa_response', 'completed', 'declined']

export default function StaffOWWA() {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const params = { status: status || undefined, search: search || undefined, date_from: dateFrom || undefined, date_to: dateTo || undefined }

  const { data: requests, isLoading } = useQuery({
    queryKey: ['staff', 'owwa', 'queue', params],
    queryFn: async () => (await api.get('/api/staff/owwa/queue', { params })).data.data,
    placeholderData: keepPreviousData,
  })

  useSocket({
    'owwa:board_update': () => queryClient.invalidateQueries({ queryKey: ['staff', 'owwa'] }),
  })

  const columns = [
    { accessorKey: 'jobseeker_name', header: 'Applicant' },
    {
      accessorKey: 'submitted_at',
      header: 'Date Submitted',
      cell: ({ row }) => dayjs(row.original.submitted_at || row.original.created_at).format('MMM D, YYYY'),
    },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    {
      id: 'days_pending',
      header: 'Days Pending',
      cell: ({ row }) => {
        const r = row.original
        if (['completed', 'declined'].includes(r.status)) return '—'
        return `${dayjs().diff(dayjs(r.submitted_at || r.created_at), 'day')}d`
      },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <Link to={`/staff/owwa/${row.original.id}`}>
          <Button size="sm" variant="secondary">View</Button>
        </Link>
      ),
    },
  ]

  return (
    <motion.div {...fadeIn} className="space-y-4">
      <PageHeader
        title="OWWA Assistance Program"
        description="Review, verify, and follow up on OWWA Assistance requests on behalf of OFWs and beneficiaries."
      />

      <Card>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label>Status</Label>
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All Statuses</option>
              {OWWA_STATUSES.map((s) => (
                <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Search Applicant</Label>
            <Input placeholder="Search by name…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div>
            <Label>Date From</Label>
            <DatePicker value={dateFrom} onChange={setDateFrom} maxDate={dateTo} />
          </div>
          <div>
            <Label>Date To</Label>
            <DatePicker value={dateTo} onChange={setDateTo} minDate={dateFrom} />
          </div>
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        data={requests}
        isLoading={isLoading}
        searchPlaceholder="Refine current results…"
        emptyTitle="No OWWA requests match these filters"
      />
    </motion.div>
  )
}
