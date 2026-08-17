import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Html5Qrcode } from 'html5-qrcode'
import { CheckCircle2, Download, KeyRound, Percent, UserCheck, Users } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'

import { Button } from '../../components/ui/Button'
import { Card, CardContent } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Input, Label, Select } from '../../components/ui/Input'
import { StatCard } from '../../components/ui/StatCard'
import { useSocket } from '../../hooks/useSocket'
import api from '../../lib/axios'
import { downloadFile, parseBlobError } from '../../lib/download'
import { manila } from '../../lib/manilaTime'
import { cn } from '../../lib/utils'

const SCANNER_ELEMENT_ID = 'spes-qr-scanner'

function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    osc.frequency.value = 880
    osc.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.12)
  } catch {
    // Audio cue is a nice-to-have — never block the scan flow if it fails.
  }
}

export function SPESScanner({ batches }) {
  const queryClient = useQueryClient()
  const [batchId, setBatchId] = useState('')
  const [eventType, setEventType] = useState('orientation')
  const [manualToken, setManualToken] = useState('')
  const [lastMarked, setLastMarked] = useState(null)
  const [exporting, setExporting] = useState(null)
  const scannerRef = useRef(null)
  const lastScanRef = useRef(null)

  const { data: dashboard } = useQuery({
    queryKey: ['staff', 'spes', 'attendance', batchId, eventType],
    queryFn: async () => (await api.get(`/api/staff/spes/batches/${batchId}/attendance`, { params: { event_type: eventType } })).data.data,
    enabled: Boolean(batchId),
  })

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['staff', 'spes', 'attendance', batchId, eventType] })
  useSocket({
    'spes:attendance_scanned': (payload) => {
      if (String(payload.batch_id) !== String(batchId) || payload.event_type !== eventType) return
      refresh()
    },
  })

  const submitToken = async (token) => {
    try {
      const res = await api.post('/api/staff/spes/scan-qr', { qr_token: token, event_type: eventType })
      setLastMarked(res.data.data.application)
      playBeep()
      toast.success(res.data.message)
      refresh()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid or duplicate QR code.')
    }
  }

  const handleExport = async (format) => {
    setExporting(format)
    try {
      await downloadFile(`/api/staff/spes/attendance/export/${format}`, {
        params: { batch_id: batchId, event_type: eventType },
        filename: `spes_${eventType}_attendance.${format === 'excel' ? 'xlsx' : 'pdf'}`,
      })
    } catch (err) {
      toast.error(await parseBlobError(err))
    } finally {
      setExporting(null)
    }
  }

  useEffect(() => {
    if (!batchId) return undefined
    const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID)
    scannerRef.current = scanner
    let stopped = false

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: 240 },
        async (decodedText) => {
          if (decodedText === lastScanRef.current) return
          lastScanRef.current = decodedText
          await submitToken(decodedText)
          setTimeout(() => {
            if (lastScanRef.current === decodedText) lastScanRef.current = null
          }, 2500)
        },
        () => {}
      )
      .catch(() => toast.error('Could not access camera — you can still enter QR tokens manually below.'))

    return () => {
      if (!stopped) {
        stopped = true
        scanner.stop().catch(() => {}).finally(() => scanner.clear().catch(() => {}))
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId, eventType])

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Card>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label>Batch</Label>
            <Select value={batchId} onChange={(e) => setBatchId(e.target.value)}>
              <option value="">Select a batch…</option>
              {(batches || []).map((b) => (
                <option key={b.id} value={b.id}>{b.batch_name}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Event Type</Label>
            <div className="flex rounded-lg border border-border-hover bg-surface p-0.5">
              {[
                { key: 'orientation', label: 'Orientation' },
                { key: 'exam', label: 'Exam' },
              ].map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setEventType(t.key)}
                  className={cn('flex-1 rounded-md px-3 py-1.5 text-sm font-medium', eventType === t.key ? 'bg-primary-800 text-white' : 'text-text-secondary hover:bg-surface-hover')}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {!batchId ? (
        <EmptyState title="Select a batch and event type" description="Choose which batch and event (Orientation or Exam) you're scanning attendance for." />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label="Eligible" value={dashboard?.total_eligible ?? '–'} icon={Users} tone="primary" />
            <StatCard label="Scanned" value={dashboard?.total_scanned ?? '–'} icon={UserCheck} tone="success" />
            <StatCard
              label="Attendance Rate"
              value={dashboard ? `${dashboard.total_eligible ? Math.round((dashboard.total_scanned / dashboard.total_eligible) * 100) : 0}%` : '–'}
              icon={Percent}
              tone="warning"
            />
          </div>

          <Card>
            <CardContent>
              <h2 className="mb-3 text-sm font-semibold text-text-primary">
                {eventType === 'orientation' ? 'Orientation' : 'Exam'} Attendance Scanner
              </h2>
              <div id={SCANNER_ELEMENT_ID} className="mx-auto w-full max-w-sm overflow-hidden rounded-lg" />

              {lastMarked && (
                <div className="mx-auto mt-3 flex max-w-sm items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">
                  <CheckCircle2 className="h-4 w-4" /> {lastMarked.full_name} — Marked Present
                </div>
              )}

              <div className="mx-auto mt-4 flex max-w-sm gap-2">
                <Input
                  placeholder="Or enter the QR token manually…"
                  value={manualToken}
                  onChange={(e) => setManualToken(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && manualToken.trim()) {
                      submitToken(manualToken.trim())
                      setManualToken('')
                    }
                  }}
                />
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!manualToken.trim()}
                  onClick={() => {
                    submitToken(manualToken.trim())
                    setManualToken('')
                  }}
                >
                  <KeyRound className="h-3.5 w-3.5" /> Mark
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-text-primary">Attendance Log</h2>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => handleExport('excel')} disabled={exporting === 'excel'}>
                    <Download className="h-3.5 w-3.5" /> Excel
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => handleExport('pdf')} disabled={exporting === 'pdf'}>
                    <Download className="h-3.5 w-3.5" /> PDF
                  </Button>
                </div>
              </div>
              {!dashboard?.logs?.length ? (
                <p className="text-sm text-text-muted">No scans yet.</p>
              ) : (
                <ul className="max-h-72 space-y-1 overflow-y-auto">
                  {dashboard.logs.map((log) => (
                    <li key={log.id} className="flex items-center justify-between text-sm text-text-secondary">
                      <span className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600" /> {log.jobseeker_name}
                      </span>
                      <span className="text-xs text-text-muted">{log.scanned_at ? manila(log.scanned_at).format('h:mm:ss A') : ''}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
