import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { motion } from 'framer-motion'
import { Download, FileDown, TrendingUp, UserCheck, Users, UserX } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'

import { Button } from '../../components/ui/Button'
import { DataTable } from '../../components/ui/DataTable'
import { Dialog, DialogContent } from '../../components/ui/Dialog'
import { Label, Select, Textarea } from '../../components/ui/Input'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatCard } from '../../components/ui/StatCard'
import { StatusBadge } from '../../components/ui/StatusBadge'
import api from '../../lib/axios'
import { downloadFile, parseBlobError } from '../../lib/download'
import { fadeIn } from '../../lib/motion'
import { cn } from '../../lib/utils'

const STATUS_TABS = [
  { key: '', label: 'All' },
  { key: 'pending_deployment', label: 'Pending Deployment' },
  { key: 'active', label: 'Active' },
  { key: 'probationary', label: 'Probationary' },
  { key: 'regular', label: 'Regular' },
  { key: 'contract_ended', label: 'Contract Ended' },
  { key: 'resigned', label: 'Resigned' },
  { key: 'terminated', label: 'Terminated' },
]

/* Mirrors EMPLOYMENT_TRANSITIONS in backend/blueprints/employment.py. */
const NEXT_STATUSES = {
  pending_deployment: ['active', 'probationary', 'terminated', 'resigned'],
  active: ['probationary', 'regular', 'contract_ended', 'resigned', 'terminated'],
  probationary: ['regular', 'active', 'contract_ended', 'resigned', 'terminated'],
  regular: ['contract_ended', 'resigned', 'terminated'],
}

const STATUS_LABELS = {
  pending_deployment: 'Pending Deployment',
  active: 'Active Employee',
  probationary: 'Probationary',
  regular: 'Regular',
  contract_ended: 'Contract Ended',
  resigned: 'Resigned',
  terminated: 'Terminated',
}

export default function EmployerEmployment() {
  const queryClient = useQueryClient()
  const [statusTab, setStatusTab] = useState('')
  const [target, setTarget] = useState(null)
  const [form, setForm] = useState({ status: '', note: '' })
  const [exporting, setExporting] = useState(false)

  const { data: records, isLoading } = useQuery({
    queryKey: ['employment', 'my-hires', statusTab],
    queryFn: async () => (await api.get('/api/employment/my-hires', { params: statusTab ? { status: statusTab } : {} })).data.data,
  })
  const { data: analytics } = useQuery({
    queryKey: ['employment', 'analytics'],
    queryFn: async () => (await api.get('/api/employment/analytics')).data.data,
  })

  const updateStatus = useMutation({
    mutationFn: ({ id, payload }) => api.put(`/api/employment/${id}/status`, payload),
    onSuccess: () => {
      toast.success('Employment status updated — employee notified.')
      queryClient.invalidateQueries({ queryKey: ['employment'] })
      setTarget(null)
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not update status.'),
  })

  const exportRecords = async (format) => {
    setExporting(true)
    try {
      await downloadFile('/api/employment/export', {
        params: { format, ...(statusTab ? { status: statusTab } : {}) },
        filename: format === 'pdf' ? 'employees.pdf' : 'employees.xlsx',
      })
    } catch (err) {
      toast.error(await parseBlobError(err))
    } finally {
      setExporting(false)
    }
  }

  const columns = [
    { accessorKey: 'jobseeker_name', header: 'Employee' },
    { accessorKey: 'position', header: 'Position' },
    {
      accessorKey: 'employment_type',
      header: 'Type',
      cell: ({ row }) => <span className="capitalize">{(row.original.employment_type || '—').replace(/_/g, ' ')}</span>,
    },
    { accessorKey: 'start_date', header: 'Start Date', cell: ({ row }) => (row.original.start_date ? dayjs(row.original.start_date).format('MMM D, YYYY') : '—') },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status} label={row.original.status_label} />,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) =>
        NEXT_STATUSES[row.original.status]?.length ? (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setTarget(row.original)
              setForm({ status: NEXT_STATUSES[row.original.status][0], note: '' })
            }}
          >
            Update Status
          </Button>
        ) : null,
    },
  ]

  return (
    <motion.div {...fadeIn} className="space-y-4">
      <PageHeader
        title="Employment Monitoring"
        description="Track hired employees through deployment, probation, regularization, and separation."
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => exportRecords('excel')} disabled={exporting}>
              <Download className="h-4 w-4" /> Excel
            </Button>
            <Button variant="secondary" size="sm" onClick={() => exportRecords('pdf')} disabled={exporting}>
              <FileDown className="h-4 w-4" /> PDF
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Hired" value={analytics?.total_hired ?? '–'} icon={Users} tone="primary" />
        <StatCard label="Hiring Success Rate" value={analytics ? `${analytics.hiring_success_rate}%` : '–'} icon={TrendingUp} tone="success" />
        <StatCard label="Retention Rate" value={analytics ? `${analytics.retention_rate}%` : '–'} icon={UserCheck} tone="warning" />
        <StatCard
          label="Avg. Hiring Time"
          value={analytics?.average_hiring_days != null ? `${analytics.average_hiring_days} days` : '–'}
          icon={UserX}
          tone="danger"
        />
      </div>

      <div className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-white p-1">
        {STATUS_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setStatusTab(t.key)}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-medium',
              statusTab === t.key ? 'bg-primary-800 text-white' : 'text-slate-600 hover:bg-slate-100',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <DataTable
        columns={columns}
        data={records}
        isLoading={isLoading}
        searchPlaceholder="Search employees…"
        emptyTitle="No employees in this view"
        emptyDescription="Hired applicants automatically appear here."
      />

      <Dialog open={!!target} onOpenChange={(open) => !open && setTarget(null)}>
        <DialogContent title="Update Employment Status">
          {target && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                <b>{target.jobseeker_name}</b> — {target.position} · currently{' '}
                <StatusBadge status={target.status} label={target.status_label} />
              </p>
              <div>
                <Label>New Status</Label>
                <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  {(NEXT_STATUSES[target.status] || []).map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Note / Reason {['terminated', 'resigned'].includes(form.status) ? '' : '(optional)'}</Label>
                <Textarea
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  placeholder={form.status === 'terminated' ? 'Reason for termination…' : 'Add a note for the record…'}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setTarget(null)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={updateStatus.isPending || (['terminated', 'resigned'].includes(form.status) && !form.note.trim())}
                  onClick={() => updateStatus.mutate({ id: target.id, payload: { status: form.status, note: form.note.trim() || undefined } })}
                >
                  Save Status
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
