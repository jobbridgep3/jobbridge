import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  CalendarClock, CheckCircle2, Clock, Download, FileText, Hourglass, PackageCheck,
  PieChart as PieChartIcon, Send, ThumbsUp, TrendingUp, XCircle,
} from 'lucide-react'
import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import toast from 'react-hot-toast'

import { Button } from '../../components/ui/Button'
import { Card, CardContent } from '../../components/ui/Card'
import { ChartCard } from '../../components/ui/ChartCard'
import { DataTable } from '../../components/ui/DataTable'
import { Label, Select } from '../../components/ui/Input'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatCard } from '../../components/ui/StatCard'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { useChartGridColors } from '../../config/chartTheme'
import { useIsMobile } from '../../hooks/useMediaQuery'
import { useSocket } from '../../hooks/useSocket'
import api from '../../lib/axios'
import { downloadFile, parseBlobError } from '../../lib/download'
import { manila } from '../../lib/manilaTime'
import { fadeIn, staggerContainer, staggerItem } from '../../lib/motion'

const DILP_STATUSES = ['pending', 'scheduled', 'completed', 'no_show', 'ready_for_claiming', 'approved', 'submitted_to_esfo']
const BLUE = '#2563eb'
const GREEN = '#16a34a'
const SLATE = '#64748b'
const AMBER = '#d97706'
const RED = '#dc2626'
const VIOLET = '#7c3aed'

export default function AdminDILP() {
  const queryClient = useQueryClient()
  const { grid, axis } = useChartGridColors()
  const isMobile = useIsMobile()
  const chartHeight = isMobile ? 220 : 260
  const [status, setStatus] = useState('')
  const [exporting, setExporting] = useState(false)

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dilp', 'stats'],
    queryFn: async () => (await api.get('/api/staff/dilp/stats')).data.data,
  })

  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['dilp', 'analytics'],
    queryFn: async () => (await api.get('/api/staff/dilp/analytics')).data.data,
  })

  const { data: applications, isLoading: applicationsLoading } = useQuery({
    queryKey: ['dilp', 'queue', status],
    queryFn: async () => (await api.get('/api/staff/dilp/queue', { params: status ? { status } : {} })).data.data,
    placeholderData: keepPreviousData,
  })

  useSocket({ 'dilp:board_update': () => queryClient.invalidateQueries({ queryKey: ['dilp'] }) })

  const handleExport = async () => {
    setExporting(true)
    try {
      await downloadFile('/api/staff/dilp/export/excel', { params: status ? { status } : {}, filename: 'dilp_report.xlsx' })
    } catch (err) {
      toast.error(await parseBlobError(err))
    } finally {
      setExporting(false)
    }
  }

  const columns = [
    { accessorKey: 'jobseeker_name', header: 'Applicant Name' },
    {
      accessorKey: 'created_at',
      header: 'Date Submitted',
      cell: ({ row }) => manila(row.original.created_at).format('MMM D, YYYY'),
    },
    { accessorKey: 'proposed_livelihood', header: 'Proposed Livelihood' },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    {
      id: 'interview_date',
      header: 'Interview Date',
      cell: ({ row }) => (row.original.interview_at ? manila(row.original.interview_at).format('MMM D, YYYY h:mm A') : '—'),
    },
  ]

  const kpis = [
    { label: 'Total Applications', value: stats?.total_applications ?? '–', icon: FileText, tone: 'primary' },
    { label: 'Pending', value: stats?.pending ?? '–', icon: Clock, tone: 'warning' },
    { label: 'Scheduled', value: stats?.scheduled ?? '–', icon: CalendarClock, tone: 'info' },
    { label: 'Completed', value: stats?.completed ?? '–', icon: CheckCircle2, tone: 'info' },
    { label: 'Ready for Claiming', value: stats?.ready_for_claiming ?? '–', icon: PackageCheck, tone: 'info' },
    { label: 'Approved', value: stats?.approved ?? '–', icon: ThumbsUp, tone: 'success' },
    { label: 'Submitted to ESFO', value: stats?.submitted_to_esfo ?? '–', icon: Send, tone: 'success' },
    { label: 'No-Show Rate', value: stats?.no_show_rate != null ? `${stats.no_show_rate}%` : '–', icon: XCircle, tone: 'danger' },
    { label: 'Avg. Pending → ESFO', value: stats?.avg_pending_to_esfo_days != null ? `${stats.avg_pending_to_esfo_days}d` : '–', icon: Hourglass, tone: 'primary' },
  ]

  return (
    <motion.div {...fadeIn} className="space-y-4">
      <PageHeader
        title="DILP — Livelihood Assistance"
        description="Read-only oversight of all DOLE Integrated Livelihood Program applications."
        actions={
          <Button variant="secondary" size="sm" onClick={handleExport} disabled={exporting}>
            <Download className="h-4 w-4" /> {exporting ? 'Exporting…' : 'Export Excel'}
          </Button>
        }
      />

      <motion.div variants={staggerContainer} initial="initial" animate="animate" className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {kpis.map((k) => (
          <motion.div key={k.label} variants={staggerItem}>
            <StatCard {...k} />
          </motion.div>
        ))}
      </motion.div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Applications per Month" icon={TrendingUp} isLoading={analyticsLoading} isEmpty={!analytics?.applications_per_month?.some((d) => d.count)} emptyTitle="No data yet">
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart data={analytics?.applications_per_month}>
              <CartesianGrid strokeDasharray="3 3" stroke={grid} />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke={axis} />
              <YAxis tick={{ fontSize: 12 }} stroke={axis} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill={BLUE} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Status Distribution" icon={PieChartIcon} isLoading={analyticsLoading} isEmpty={!analytics?.status_distribution?.some((d) => d.count)} emptyTitle="No data yet">
          <ResponsiveContainer width="100%" height={chartHeight}>
            <PieChart>
              <Pie data={analytics?.status_distribution} dataKey="count" nameKey="label" cx="50%" cy="50%" outerRadius={isMobile ? 65 : 80} label={(e) => e.label}>
                {analytics?.status_distribution?.map((d, i) => (
                  <Cell key={d.label} fill={[AMBER, BLUE, GREEN, RED, VIOLET, GREEN, SLATE][i % 7]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <Card>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div>
            <Label>Status</Label>
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All Statuses</option>
              {DILP_STATUSES.map((s) => (
                <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
              ))}
            </Select>
          </div>
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        data={applications}
        isLoading={applicationsLoading || statsLoading}
        searchPlaceholder="Search applicant…"
        emptyTitle="No DILP applications match these filters"
      />
    </motion.div>
  )
}
