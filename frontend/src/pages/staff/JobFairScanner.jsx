import { useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { Html5Qrcode } from 'html5-qrcode'
import { motion } from 'framer-motion'
import { ArrowLeft, CheckCircle2, KeyRound, Percent, UserCheck, Users } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { Link, useParams } from 'react-router-dom'

import { Button } from '../../components/ui/Button'
import { Card, CardContent } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { StatCard } from '../../components/ui/StatCard'
import { useSocket } from '../../hooks/useSocket'
import api from '../../lib/axios'
import { fadeIn } from '../../lib/motion'

const SCANNER_ELEMENT_ID = 'jobfair-qr-scanner'

export default function StaffJobFairScanner({ basePath = '/staff' }) {
  const { id } = useParams()
  const queryClient = useQueryClient()
  const scannerRef = useRef(null)
  const lastScanRef = useRef(null)
  const [manualToken, setManualToken] = useState('')

  const { data: dashboard } = useQuery({
    queryKey: ['jobfair', id, 'attendance'],
    queryFn: async () => (await api.get(`/api/staff/jobfair/${id}/attendance`)).data.data,
    refetchInterval: 30000,
  })

  const refreshDashboard = () => queryClient.invalidateQueries({ queryKey: ['jobfair', id, 'attendance'] })

  useSocket({
    'jobfair:qr_scanned': (payload) => {
      if (String(payload.jobfair_id) !== String(id)) return
      refreshDashboard()
    },
  })

  const submitToken = async (token) => {
    try {
      const res = await api.post(`/api/staff/jobfair/${id}/scan-qr`, { qr_token: token })
      toast.success(`Attendance marked: ${res.data.data.jobseeker_name || 'Jobseeker'}`)
      refreshDashboard()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid or duplicate QR code.')
    }
  }

  useEffect(() => {
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
  }, [id])

  const scannedLogs = (dashboard?.logs || []).filter((l) => l.attended)

  return (
    <motion.div {...fadeIn} className="mx-auto max-w-3xl space-y-4">
      <Link to={`${basePath}/jobfair`} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-primary-700">
        <ArrowLeft className="h-4 w-4" /> Back to Job Fairs
      </Link>

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Registered" value={dashboard?.total_registered ?? '–'} icon={Users} tone="primary" />
        <StatCard label="Attended" value={dashboard?.total_attended ?? '–'} icon={UserCheck} tone="success" />
        <StatCard label="Attendance Rate" value={dashboard ? `${dashboard.attendance_rate}%` : '–'} icon={Percent} tone="warning" />
      </div>

      <Card>
        <CardContent>
          <h1 className="mb-3 text-lg font-semibold text-slate-900">
            QR Attendance Scanner{dashboard?.jobfair?.name ? ` — ${dashboard.jobfair.name}` : ''}
          </h1>
          <div id={SCANNER_ELEMENT_ID} className="mx-auto w-full max-w-sm overflow-hidden rounded-lg" />
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
          <h2 className="mb-2 text-sm font-semibold text-slate-800">Attendance Log</h2>
          {!scannedLogs.length ? (
            <p className="text-sm text-slate-400">No scans yet.</p>
          ) : (
            <ul className="max-h-72 space-y-1 overflow-y-auto">
              {scannedLogs.map((log, i) => (
                <li key={i} className="flex items-center justify-between text-sm text-slate-700">
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" /> {log.jobseeker_name}
                    <span className="text-xs text-slate-400">{log.registration_number}</span>
                  </span>
                  <span className="text-xs text-slate-400">{log.scanned_at ? dayjs(log.scanned_at).format('h:mm:ss A') : ''}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
