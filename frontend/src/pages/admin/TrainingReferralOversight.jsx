import { useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { motion } from 'framer-motion'
import { useMemo, useState } from 'react'

import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { DataTable } from '../../components/ui/DataTable'
import { DatePicker } from '../../components/ui/DatePicker'
import { Label, Select } from '../../components/ui/Input'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { useSocket } from '../../hooks/useSocket'
import api from '../../lib/axios'
import { fadeIn } from '../../lib/motion'

const APPLICATION_STATUSES = ['pending', 'pooled', 'submitted_to_tesda', 'for_tesda_response', 'completed', 'declined']
const BATCH_STATUSES = ['forming', 'submitted_to_tesda', 'for_tesda_response', 'completed', 'declined']

export default function AdminTrainingReferralOversight() {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState('')
  const [batchId, setBatchId] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [batchStatus, setBatchStatus] = useState('')

  const { data: applications, isLoading: appsLoading } = useQuery({
    queryKey: ['admin', 'training_referral', 'applications'],
    queryFn: async () => (await api.get('/api/staff/training-referral/applications')).data.data,
  })

  const { data: batches, isLoading: batchesLoading } = useQuery({
    queryKey: ['admin', 'training_referral', 'batches', batchStatus],
    queryFn: async () => (await api.get('/api/staff/training-referral/batches', { params: batchStatus ? { status: batchStatus } : {} })).data.data,
  })

  useSocket({
    'training_referral:board_update': () => queryClient.invalidateQueries({ queryKey: ['admin', 'training_referral'] }),
  })

  const filteredApplications = useMemo(() => {
    return (applications || []).filter((app) => {
      if (status && app.status !== status) return false
      if (batchId && app.batch_id !== batchId) return false
      const appliedOn = dayjs(app.application_date || app.created_at)
      if (dateFrom && appliedOn.isBefore(dayjs(dateFrom), 'day')) return false
      if (dateTo && appliedOn.isAfter(dayjs(dateTo), 'day')) return false
      return true
    })
  }, [applications, status, batchId, dateFrom, dateTo])

  const applicationColumns = [
    { accessorKey: 'jobseeker_name', header: 'Jobseeker' },
    { accessorKey: 'program_interest', header: 'Program Interest' },
    { accessorKey: 'batch_name', header: 'Batch', cell: ({ row }) => row.original.batch_name || '—' },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    {
      accessorKey: 'application_date',
      header: 'Date Applied',
      cell: ({ row }) => dayjs(row.original.application_date || row.original.created_at).format('MMM D, YYYY'),
    },
    { accessorKey: 'remarks', header: 'Remarks', cell: ({ row }) => row.original.remarks || '—' },
  ]

  const batchColumns = [
    { accessorKey: 'batch_name', header: 'Batch Name' },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    { accessorKey: 'current_pax', header: 'Pax', cell: ({ row }) => `${row.original.current_pax}/${row.original.min_pax}` },
    {
      accessorKey: 'submitted_to_tesda_date',
      header: 'Submitted to TESDA',
      cell: ({ row }) => (row.original.submitted_to_tesda_date ? dayjs(row.original.submitted_to_tesda_date).format('MMM D, YYYY') : '—'),
    },
    {
      accessorKey: 'tesda_response_date',
      header: 'TESDA Response',
      cell: ({ row }) => (row.original.tesda_response_date ? dayjs(row.original.tesda_response_date).format('MMM D, YYYY') : '—'),
    },
  ]

  return (
    <motion.div {...fadeIn} className="space-y-4">
      <PageHeader title="ManPower Skills Management" description="Read-only view of all ManPower Skills Management applications and batches." />

      <Card>
        <CardHeader>
          <CardTitle>Applications</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label>Status</Label>
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All Statuses</option>
              {APPLICATION_STATUSES.map((s) => (
                <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Batch</Label>
            <Select value={batchId} onChange={(e) => setBatchId(e.target.value)}>
              <option value="">All Batches</option>
              {batches?.map((b) => (
                <option key={b.id} value={b.id}>{b.batch_name}</option>
              ))}
            </Select>
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
        columns={applicationColumns}
        data={filteredApplications}
        isLoading={appsLoading}
        searchPlaceholder="Search jobseeker or program…"
        emptyTitle="No applications match these filters"
      />

      <Card>
        <CardHeader>
          <CardTitle>Batches</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div>
            <Label>Status</Label>
            <Select value={batchStatus} onChange={(e) => setBatchStatus(e.target.value)}>
              <option value="">All Statuses</option>
              {BATCH_STATUSES.map((s) => (
                <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
              ))}
            </Select>
          </div>
        </CardContent>
      </Card>

      <DataTable columns={batchColumns} data={batches} isLoading={batchesLoading} searchPlaceholder="Search batch name…" emptyTitle="No batches match these filters" />
    </motion.div>
  )
}
