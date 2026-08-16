import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'

import { Button } from '../../components/ui/Button'
import { Card, CardContent } from '../../components/ui/Card'
import { useConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Dialog, DialogContent } from '../../components/ui/Dialog'
import { EmptyState } from '../../components/ui/EmptyState'
import { Label, Select, Textarea } from '../../components/ui/Input'
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
    label: 'Orientation Result', sourceStatus: 'attended_orientation', endpoint: '/api/staff/spes/orientation-outcomes/bulk',
    passedStatus: 'orientation_passed', failedStatus: 'failed_orientation',
  },
  exam: {
    label: 'Exam Result', sourceStatus: 'attended_exam', endpoint: '/api/staff/spes/exam-results/bulk',
    passedStatus: 'passed', failedStatus: 'failed',
  },
}

export function SPESOutcomes({ batches }) {
  const queryClient = useQueryClient()
  const [batchId, setBatchId] = useState('')
  const [mode, setMode] = useState('orientation')
  const [selected, setSelected] = useState(new Set())
  const [remarks, setRemarks] = useState('')
  const [exporting, setExporting] = useState(null)
  const [bulkResult, setBulkResult] = useState(null)
  const { confirm, ConfirmDialogElement } = useConfirmDialog()

  const config = MODES[mode]

  const { data: applications, isLoading } = useQuery({
    queryKey: ['staff', 'spes', 'applications', { batchId, status: config.sourceStatus }],
    queryFn: async () => (await api.get('/api/staff/spes/applications', { params: { batch_id: batchId, status: config.sourceStatus } })).data.data,
    enabled: Boolean(batchId),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['staff', 'spes'] })
  useSocket({ 'spes:status_change': invalidate, 'spes:board_update': invalidate })

  const resetSelection = () => setSelected(new Set())

  const toggleSelected = (id) => {
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    setSelected((s) => (s.size === applications?.length ? new Set() : new Set((applications || []).map((a) => a.id))))
  }

  const bulkMark = useMutation({
    mutationFn: (result) => {
      const items = [...selected].map((application_id) => ({ application_id, result, remarks: remarks.trim() || undefined }))
      return api.post(config.endpoint, { items })
    },
    onSuccess: (res) => {
      setBulkResult(res.data.data)
      resetSelection()
      setRemarks('')
      invalidate()
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not save outcomes.'),
  })

  const confirmBulkMark = (result) => {
    const label = result === 'passed' ? 'Passed' : 'Failed'
    confirm({
      title: `Mark ${selected.size} selected applicant${selected.size === 1 ? '' : 's'} as ${label}?`,
      description: `Are you sure you want to mark ${selected.size} selected applicant${selected.size === 1 ? '' : 's'} as ${label}?`,
      confirmLabel: `Mark as ${label}`,
      danger: result === 'failed',
      onConfirm: async () => {
        try {
          await bulkMark.mutateAsync(result)
        } catch {
          // Failure toast already shown by the mutation's onError handler.
        }
      },
    })
  }

  const handleExport = async (resultStatus, format) => {
    const key = `${resultStatus}-${format}`
    setExporting(key)
    try {
      await downloadFile(`/api/staff/spes/outcomes/export/${format}`, {
        params: { batch_id: batchId || undefined, mode, result: resultStatus === config.passedStatus ? 'passed' : 'failed' },
        filename: `spes_${resultStatus}.${format === 'excel' ? 'xlsx' : 'pdf'}`,
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
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label>Batch</Label>
            <Select value={batchId} onChange={(e) => { setBatchId(e.target.value); resetSelection() }}>
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
                  onClick={() => { setMode(key); resetSelection() }}
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
        <>
          {selected.size > 0 && (
            <Card>
              <CardContent className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-medium text-text-primary">{selected.size} selected</span>
                <div className="min-w-[220px] flex-1">
                  <Textarea
                    placeholder="Remarks for all selected (optional)…"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    rows={1}
                  />
                </div>
                <Button size="sm" onClick={() => confirmBulkMark('passed')} disabled={bulkMark.isPending}>
                  Mark Selected as Passed
                </Button>
                <Button size="sm" variant="danger" onClick={() => confirmBulkMark('failed')} disabled={bulkMark.isPending}>
                  Mark Selected as Failed
                </Button>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="space-y-2">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase text-text-muted">
                    <tr>
                      <th className="px-2 py-2">
                        <input
                          type="checkbox"
                          checked={selected.size > 0 && selected.size === applications.length}
                          onChange={toggleSelectAll}
                          className="rounded border-slate-300"
                          aria-label="Select all"
                        />
                      </th>
                      <th className="px-2 py-2">Applicant</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {applications.map((app) => (
                      <tr key={app.id}>
                        <td className="px-2 py-2">
                          <input
                            type="checkbox"
                            checked={selected.has(app.id)}
                            onChange={() => toggleSelected(app.id)}
                            className="rounded border-slate-300"
                          />
                        </td>
                        <td className="px-2 py-2 text-text-primary">{app.full_name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={bulkResult !== null} onOpenChange={(open) => !open && setBulkResult(null)}>
        <DialogContent
          title="Bulk Action Results"
          description={`${bulkResult?.saved || 0} succeeded, ${bulkResult?.errors?.length || 0} failed.`}
        >
          {bulkResult?.errors?.map((e) => (
            <p key={e.application_id} className="text-xs text-red-600">{e.application_id}: {e.error}</p>
          ))}
        </DialogContent>
      </Dialog>

      {ConfirmDialogElement}
    </div>
  )
}
