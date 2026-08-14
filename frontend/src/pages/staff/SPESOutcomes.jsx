import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'

import { Button } from '../../components/ui/Button'
import { Card, CardContent } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Input, Label, Select } from '../../components/ui/Input'
import { TableSkeleton } from '../../components/ui/Skeleton'
import { useSocket } from '../../hooks/useSocket'
import api from '../../lib/axios'
import { downloadFile, parseBlobError } from '../../lib/download'
import { cn } from '../../lib/utils'

// Attendance is recorded automatically by the QR scanner (see SPESScanner.jsx) — this
// screen only manages the Staff-driven Passed/Failed judgment for applicants who
// already attended, keeping attendance and result strictly separate per PESO's process.
const MODES = {
  orientation: {
    label: 'Orientation Result', sourceStatus: 'attended_orientation', valueKey: 'result',
    options: [['passed', 'Passed'], ['failed', 'Failed']], endpoint: '/api/staff/spes/orientation-outcomes/bulk',
    passedStatus: 'orientation_passed', failedStatus: 'failed_orientation',
  },
  exam: {
    label: 'Exam Result', sourceStatus: 'attended_exam', valueKey: 'result',
    options: [['passed', 'Passed'], ['failed', 'Failed']], endpoint: '/api/staff/spes/exam-results/bulk',
    passedStatus: 'passed', failedStatus: 'failed',
  },
}

export function SPESOutcomes({ batches }) {
  const queryClient = useQueryClient()
  const [batchId, setBatchId] = useState('')
  const [mode, setMode] = useState('orientation')
  const [rows, setRows] = useState({}) // application_id -> { value, remarks }
  const [exporting, setExporting] = useState(null)

  const config = MODES[mode]

  const { data: applications, isLoading } = useQuery({
    queryKey: ['staff', 'spes', 'applications', { batchId, status: config.sourceStatus }],
    queryFn: async () => (await api.get('/api/staff/spes/applications', { params: { batch_id: batchId, status: config.sourceStatus } })).data.data,
    enabled: Boolean(batchId),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['staff', 'spes'] })
  useSocket({ 'spes:status_change': invalidate })

  const setRow = (id, patch) => setRows((r) => ({ ...r, [id]: { ...r[id], ...patch } }))

  const bulkSave = useMutation({
    mutationFn: () => {
      const items = Object.entries(rows)
        .filter(([, v]) => v?.value)
        .map(([application_id, v]) => ({ application_id, [config.valueKey]: v.value, remarks: v.remarks }))
      return api.post(config.endpoint, { items })
    },
    onSuccess: (res) => {
      toast.success(res.data.message)
      setRows({})
      invalidate()
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not save outcomes.'),
  })

  const handleExport = async (resultStatus, format) => {
    const key = `${resultStatus}-${format}`
    setExporting(key)
    try {
      await downloadFile(`/api/staff/spes/reports/export/${format}`, {
        params: { batch_id: batchId || undefined, status: resultStatus },
        filename: `spes_${resultStatus}.${format === 'excel' ? 'xlsx' : 'pdf'}`,
      })
    } catch (err) {
      toast.error(await parseBlobError(err))
    } finally {
      setExporting(null)
    }
  }

  const readyCount = Object.values(rows).filter((v) => v?.value).length

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label>Batch</Label>
            <Select value={batchId} onChange={(e) => { setBatchId(e.target.value); setRows({}) }}>
              <option value="">Select a batch…</option>
              {(batches || []).map((b) => (
                <option key={b.id} value={b.id}>{b.batch_name}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Mode</Label>
            <div className="flex rounded-lg border border-border-hover bg-surface p-0.5">
              {Object.entries(MODES).map(([key, m]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => { setMode(key); setRows({}) }}
                  className={cn('flex-1 rounded-md px-3 py-1.5 text-sm font-medium', mode === key ? 'bg-primary-800 text-white' : 'text-text-secondary hover:bg-surface-hover')}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-text-secondary">Export applicants who {mode === 'orientation' ? 'passed or failed Orientation/Interview' : 'passed or failed the Exam'}:</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => handleExport(config.passedStatus, 'excel')} disabled={exporting === `${config.passedStatus}-excel`}>
              <Download className="h-3.5 w-3.5" /> Passed (Excel)
            </Button>
            <Button size="sm" variant="secondary" onClick={() => handleExport(config.passedStatus, 'pdf')} disabled={exporting === `${config.passedStatus}-pdf`}>
              <Download className="h-3.5 w-3.5" /> Passed (PDF)
            </Button>
            <Button size="sm" variant="secondary" onClick={() => handleExport(config.failedStatus, 'excel')} disabled={exporting === `${config.failedStatus}-excel`}>
              <Download className="h-3.5 w-3.5" /> Failed (Excel)
            </Button>
            <Button size="sm" variant="secondary" onClick={() => handleExport(config.failedStatus, 'pdf')} disabled={exporting === `${config.failedStatus}-pdf`}>
              <Download className="h-3.5 w-3.5" /> Failed (PDF)
            </Button>
          </div>
        </CardContent>
      </Card>

      {!batchId ? (
        <EmptyState title="Select a batch" description="Choose a batch to encode orientation or exam results." />
      ) : isLoading ? (
        <TableSkeleton />
      ) : !applications?.length ? (
        <EmptyState title="No applicants at this stage" description={`No applicants have attended ${mode === 'orientation' ? 'orientation' : 'the exam'} yet in this batch, awaiting a result.`} />
      ) : (
        <Card>
          <CardContent className="space-y-2">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-text-muted">
                  <tr>
                    <th className="px-2 py-2">Applicant</th>
                    <th className="px-2 py-2">{config.label}</th>
                    <th className="px-2 py-2">Remarks (optional)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {applications.map((app) => (
                    <tr key={app.id}>
                      <td className="px-2 py-2 text-text-primary">{app.full_name}</td>
                      <td className="px-2 py-2">
                        <Select
                          value={rows[app.id]?.value || ''}
                          onChange={(e) => setRow(app.id, { value: e.target.value })}
                        >
                          <option value="">—</option>
                          {config.options.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
                        </Select>
                      </td>
                      <td className="px-2 py-2">
                        <Input value={rows[app.id]?.remarks || ''} onChange={(e) => setRow(app.id, { remarks: e.target.value })} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => bulkSave.mutate()} disabled={bulkSave.isPending || !readyCount}>
                {bulkSave.isPending ? 'Saving…' : `Save ${readyCount || ''} ${config.label}${readyCount === 1 ? '' : 's'}`.trim()}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
