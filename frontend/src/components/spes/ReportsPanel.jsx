import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, ClipboardList, Download, GraduationCap, TrendingUp, Users } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'

import { Button } from '../ui/Button'
import { Card, CardContent } from '../ui/Card'
import { Label, Select } from '../ui/Input'
import { StatCard } from '../ui/StatCard'
import { ChartSkeleton } from '../ui/Skeleton'
import api from '../../lib/axios'
import { downloadFile, parseBlobError } from '../../lib/download'

/** Shared SPES reports/analytics panel used by both Staff's Reports tab (default:
 * all batches, can scope to one) and Admin's Reports tab (system-wide, same
 * endpoints — the backend's GET /api/staff/spes/reports/* routes are
 * role_required("staff","admin"), so there's no separate admin-only reporting
 * endpoint to call here). */
export function ReportsPanel({ batches }) {
  const [batchId, setBatchId] = useState('')
  const [exporting, setExporting] = useState(null)

  const { data: stats, isLoading } = useQuery({
    queryKey: ['staff', 'spes', 'reports', 'stats', batchId],
    queryFn: async () => (await api.get('/api/staff/spes/reports/stats', { params: { batch_id: batchId || undefined } })).data.data,
  })

  const handleExport = async (format) => {
    setExporting(format)
    try {
      await downloadFile(`/api/staff/spes/reports/export/${format}`, {
        params: { batch_id: batchId || undefined },
        filename: `spes_report.${format === 'excel' ? 'xlsx' : 'pdf'}`,
      })
    } catch (err) {
      toast.error(await parseBlobError(err))
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-end justify-between gap-4">
          <div className="w-full max-w-xs">
            <Label>Batch</Label>
            <Select value={batchId} onChange={(e) => setBatchId(e.target.value)}>
              <option value="">All Batches</option>
              {(batches || []).map((b) => (
                <option key={b.id} value={b.id}>{b.batch_name}</option>
              ))}
            </Select>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => handleExport('excel')} disabled={exporting === 'excel'}>
              <Download className="h-4 w-4" /> {exporting === 'excel' ? 'Exporting…' : 'Export Excel'}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => handleExport('pdf')} disabled={exporting === 'pdf'}>
              <Download className="h-4 w-4" /> {exporting === 'pdf' ? 'Exporting…' : 'Export PDF'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading || !stats ? (
        <ChartSkeleton />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total Applications" value={stats.total_applications} icon={Users} tone="primary" />
            <StatCard label="Pending Review" value={stats.pending_review} icon={ClipboardList} tone="warning" />
            <StatCard label="Deployed" value={stats.deployed} icon={CheckCircle2} tone="success" />
            <StatCard label="Completed" value={stats.completed} icon={GraduationCap} tone="success" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Orientation Attendance" value={stats.orientation_attendance_rate != null ? `${stats.orientation_attendance_rate}%` : '—'} icon={TrendingUp} tone="primary" />
            <StatCard label="Exam Attendance" value={stats.exam_attendance_rate != null ? `${stats.exam_attendance_rate}%` : '—'} icon={TrendingUp} tone="primary" />
            <StatCard label="Pass Rate" value={stats.pass_rate != null ? `${stats.pass_rate}%` : '—'} icon={TrendingUp} tone="success" />
            <StatCard label="DTR Compliance" value={stats.dtr_compliance_rate != null ? `${stats.dtr_compliance_rate}%` : '—'} icon={TrendingUp} tone="warning" />
          </div>

          <Card>
            <CardContent>
              <p className="mb-3 text-sm font-semibold text-text-primary">Wage Subsidy (Reference Only)</p>
              <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
                <div>
                  <p className="text-text-muted">Budget Allocation</p>
                  <p className="text-text-primary">{stats.budget_allocation != null ? `₱${stats.budget_allocation.toLocaleString()}` : 'Not set'}</p>
                </div>
                <div>
                  <p className="text-text-muted">Employer Share (60%)</p>
                  <p className="text-text-primary">{stats.wage_subsidy_employer_share != null ? `₱${stats.wage_subsidy_employer_share.toLocaleString()}` : '—'}</p>
                </div>
                <div>
                  <p className="text-text-muted">DOLE Share (40%)</p>
                  <p className="text-text-primary">{stats.wage_subsidy_dole_share != null ? `₱${stats.wage_subsidy_dole_share.toLocaleString()}` : '—'}</p>
                </div>
              </div>
              <p className="mt-3 text-xs text-text-muted">
                These figures are a simple 60/40 reference split of the batch's budget allocation, for planning purposes only — not a disbursement record.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <p className="mb-3 text-sm font-semibold text-text-primary">Applicant Funnel</p>
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                {[
                  ['Pending Review', stats.pending_review], ['Approved for Orientation', stats.approved_for_orientation],
                  ['Attended Orientation', stats.attended_orientation], ['Failed Orientation', stats.failed_orientation],
                  ['Passed', stats.passed], ['Failed', stats.failed],
                  ['Awaiting Deployment', stats.for_deployment], ['Deployed', stats.deployed],
                  ['Completed', stats.completed], ['Terminated', stats.terminated], ['Rejected', stats.rejected],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-border-subtle p-3">
                    <p className="text-text-muted">{label}</p>
                    <p className="text-lg font-semibold text-text-primary">{value}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
