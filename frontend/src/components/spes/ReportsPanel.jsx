import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, ClipboardList, Download, TrendingUp, Users, XCircle } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'

import { Button } from '../ui/Button'
import { Card, CardContent } from '../ui/Card'
import { DatePicker } from '../ui/DatePicker'
import { Input, Label, Select } from '../ui/Input'
import { StatCard } from '../ui/StatCard'
import { ChartSkeleton } from '../ui/Skeleton'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import api from '../../lib/axios'
import { downloadFile, parseBlobError } from '../../lib/download'

const STATUS_OPTIONS = [
  ['pending_review', 'Pending Review'], ['rejected', 'Rejected'], ['approved_for_orientation', 'Approved for Orientation'],
  ['attended_orientation', 'Attended Orientation (result pending)'], ['orientation_passed', 'Orientation Passed'], ['failed_orientation', 'Orientation Failed'],
  ['attended_exam', 'Attended Exam (result pending)'], ['passed', 'Exam Passed'], ['failed', 'Exam Failed'],
]
const ATTENDANCE_OPTIONS = [
  ['orientation_attended', 'Orientation — Attended'], ['orientation_absent', 'Orientation — Absent'],
  ['exam_attended', 'Exam — Attended'], ['exam_absent', 'Exam — Absent'],
]

/** Shared SPES reports/analytics panel used by both Staff's Reports tab (default:
 * all batches, can scope to one) and Admin's Reports tab (system-wide, same
 * endpoints — the backend's GET /api/staff/spes/reports/* routes are
 * role_required("staff","admin"), so there's no separate admin-only reporting
 * endpoint to call here, and both roles always see identical data/calculations). */
export function ReportsPanel({ batches }) {
  const [batchId, setBatchId] = useState('')
  const [status, setStatus] = useState('')
  const [attendance, setAttendance] = useState('')
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [exporting, setExporting] = useState(null)
  const debouncedSearch = useDebouncedValue(search)

  const params = {
    batch_id: batchId || undefined, status: status || undefined, attendance: attendance || undefined,
    search: debouncedSearch || undefined, date_from: dateFrom || undefined, date_to: dateTo || undefined,
  }

  const { data: stats, isLoading } = useQuery({
    queryKey: ['staff', 'spes', 'reports', 'stats', params],
    queryFn: async () => (await api.get('/api/staff/spes/reports/stats', { params })).data.data,
  })

  const handleExport = async (format) => {
    setExporting(format)
    try {
      await downloadFile(`/api/staff/spes/reports/export/${format}`, {
        params,
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
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <Label>Batch</Label>
              <Select value={batchId} onChange={(e) => setBatchId(e.target.value)}>
                <option value="">All Batches</option>
                {(batches || []).map((b) => (
                  <option key={b.id} value={b.id}>{b.batch_name}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Orientation / Exam Result</Label>
              <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">All Statuses</option>
                {STATUS_OPTIONS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
              </Select>
            </div>
            <div>
              <Label>Attendance</Label>
              <Select value={attendance} onChange={(e) => setAttendance(e.target.value)}>
                <option value="">Any</option>
                {ATTENDANCE_OPTIONS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
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
          </div>
          <div className="flex justify-end gap-2">
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard label="Total Applicants" value={stats.total_applicants} icon={Users} tone="primary" />
            <StatCard label="Pending Review" value={stats.pending_review} icon={ClipboardList} tone="warning" />
            <StatCard label="Rejected" value={stats.rejected} icon={XCircle} tone="danger" />
          </div>

          <Card>
            <CardContent>
              <p className="mb-3 text-sm font-semibold text-text-primary">Orientation / Interview</p>
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <div className="rounded-lg border border-border-subtle p-3"><p className="text-text-muted">Attended</p><p className="text-lg font-semibold text-text-primary">{stats.orientation_attended}</p></div>
                <div className="rounded-lg border border-border-subtle p-3"><p className="text-text-muted">Absent</p><p className="text-lg font-semibold text-text-primary">{stats.orientation_absent}</p></div>
                <div className="rounded-lg border border-border-subtle p-3"><p className="text-text-muted">Passed</p><p className="text-lg font-semibold text-text-primary">{stats.orientation_passed}</p></div>
                <div className="rounded-lg border border-border-subtle p-3"><p className="text-text-muted">Failed</p><p className="text-lg font-semibold text-text-primary">{stats.orientation_failed}</p></div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <p className="mb-3 text-sm font-semibold text-text-primary">Exam</p>
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <div className="rounded-lg border border-border-subtle p-3"><p className="text-text-muted">Attended</p><p className="text-lg font-semibold text-text-primary">{stats.exam_attended}</p></div>
                <div className="rounded-lg border border-border-subtle p-3"><p className="text-text-muted">Absent</p><p className="text-lg font-semibold text-text-primary">{stats.exam_absent}</p></div>
                <div className="rounded-lg border border-border-subtle p-3"><p className="text-text-muted">Passed</p><p className="text-lg font-semibold text-text-primary">{stats.exam_passed}</p></div>
                <div className="rounded-lg border border-border-subtle p-3"><p className="text-text-muted">Failed</p><p className="text-lg font-semibold text-text-primary">{stats.exam_failed}</p></div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label="Orientation Attendance Rate" value={stats.orientation_attendance_rate != null ? `${stats.orientation_attendance_rate}%` : '—'} icon={TrendingUp} tone="primary" />
            <StatCard label="Exam Attendance Rate" value={stats.exam_attendance_rate != null ? `${stats.exam_attendance_rate}%` : '—'} icon={TrendingUp} tone="primary" />
            <StatCard label="Exam Pass Rate" value={stats.pass_rate != null ? `${stats.pass_rate}%` : '—'} icon={CheckCircle2} tone="success" />
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
        </>
      )}
    </div>
  )
}
