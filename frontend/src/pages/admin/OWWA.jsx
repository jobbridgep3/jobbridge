import { useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { motion } from 'framer-motion'
import { CheckCircle2, Clock, Download, FileText, Hourglass, PieChart as PieChartIcon, TrendingUp, XCircle } from 'lucide-react'
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
import { fadeIn, staggerContainer, staggerItem } from '../../lib/motion'

const OWWA_STATUSES = ['pending', 'verified', 'submitted_to_owwa', 'for_owwa_response', 'completed', 'declined']
const BLUE = '#2563eb'
const GREEN = '#16a34a'
const SLATE = '#64748b'
const AMBER = '#d97706'
const RED = '#dc2626'

export default function AdminOWWA() {
  const queryClient = useQueryClient()
  const { grid, axis } = useChartGridColors()
  const isMobile = useIsMobile()
  const chartHeight = isMobile ? 220 : 260
  const [status, setStatus] = useState('')
  const [exporting, setExporting] = useState(null)

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['owwa', 'stats'],
    queryFn: async () => (await api.get('/api/staff/owwa/stats')).data.data,
  })

  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['owwa', 'analytics'],
    queryFn: async () => (await api.get('/api/staff/owwa/analytics')).data.data,
  })

  const { data: requests, isLoading: requestsLoading } = useQuery({
    queryKey: ['owwa', 'requests', status],
    queryFn: async () => (await api.get('/api/staff/owwa/queue', { params: status ? { status } : {} })).data.data,
  })

  useSocket({
    'owwa:board_update': () => queryClient.invalidateQueries({ queryKey: ['owwa'] }),
  })

  const handleExport = async (format) => {
    setExporting(format)
    try {
      await downloadFile(`/api/staff/owwa/export/${format}`, {
        params: status ? { status } : {},
        filename: `owwa_assistance_report.${format === 'excel' ? 'xlsx' : 'pdf'}`,
      })
    } catch (err) {
      toast.error(await parseBlobError(err))
    } finally {
      setExporting(null)
    }
  }

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
  ]

  const kpis = [
    { label: 'Total Requests', value: stats?.total_requests ?? '–', icon: FileText, tone: 'primary' },
    { label: 'Pending', value: stats?.pending ?? '–', icon: Clock, tone: 'warning' },
    { label: 'In Progress', value: stats?.in_progress ?? '–', icon: Hourglass, tone: 'info' },
    { label: 'Completed', value: stats?.completed ?? '–', icon: CheckCircle2, tone: 'success' },
    { label: 'Declined', value: stats?.declined ?? '–', icon: XCircle, tone: 'danger' },
    { label: 'Avg. Processing Time', value: stats?.avg_processing_days != null ? `${stats.avg_processing_days}d` : '–', icon: TrendingUp, tone: 'primary' },
  ]

  return (
    <motion.div {...fadeIn} className="space-y-4">
      <PageHeader
        title="OWWA Assistance Program"
        description="Read-only oversight of all OWWA Assistance requests."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => handleExport('excel')} disabled={exporting === 'excel'}>
              <Download className="h-4 w-4" /> {exporting === 'excel' ? 'Exporting…' : 'Export Excel'}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => handleExport('pdf')} disabled={exporting === 'pdf'}>
              <Download className="h-4 w-4" /> {exporting === 'pdf' ? 'Exporting…' : 'Export PDF'}
            </Button>
          </>
        }
      />

      <motion.div variants={staggerContainer} initial="initial" animate="animate" className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {kpis.map((k) => (
          <motion.div key={k.label} variants={staggerItem}>
            <StatCard {...k} />
          </motion.div>
        ))}
      </motion.div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Requests per Month" icon={TrendingUp} isLoading={analyticsLoading} isEmpty={!analytics?.requests_per_month?.some((d) => d.count)} emptyTitle="No data yet">
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart data={analytics?.requests_per_month}>
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
                  <Cell key={d.label} fill={[AMBER, GREEN, BLUE, AMBER, GREEN, RED][i % 6] || SLATE} />
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
              {OWWA_STATUSES.map((s) => (
                <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
              ))}
            </Select>
          </div>
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        data={requests}
        isLoading={requestsLoading || statsLoading}
        searchPlaceholder="Search applicant…"
        emptyTitle="No OWWA requests match these filters"
      />
    </motion.div>
  )
}
