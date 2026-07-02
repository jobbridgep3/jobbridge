import { useQueryClient } from '@tanstack/react-query'
import { Html5Qrcode } from 'html5-qrcode'
import { motion } from 'framer-motion'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { Link, useParams } from 'react-router-dom'

import { Card, CardContent } from '../../components/ui/Card'
import { useSocket } from '../../hooks/useSocket'
import api from '../../lib/axios'
import { fadeIn } from '../../lib/motion'

const SCANNER_ELEMENT_ID = 'jobfair-qr-scanner'

export default function StaffJobFairScanner({ basePath = '/staff' }) {
  const { id } = useParams()
  const queryClient = useQueryClient()
  const scannerRef = useRef(null)
  const lastScanRef = useRef(null)
  const [scanCount, setScanCount] = useState(0)
  const [recentScans, setRecentScans] = useState([])

  useSocket({
    'jobfair:qr_scanned': (payload) => {
      if (String(payload.jobfair_id) !== String(id)) return
      setScanCount((c) => c + 1)
      setRecentScans((prev) => [payload, ...prev].slice(0, 10))
    },
  })

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
          try {
            const res = await api.post(`/api/staff/jobfair/${id}/scan-qr`, { qr_token: decodedText })
            toast.success(`Attendance marked: ${res.data.data.jobseeker_name || 'Jobseeker'}`)
          } catch (err) {
            toast.error(err.response?.data?.message || 'Invalid or duplicate QR code.')
          }
          setTimeout(() => {
            if (lastScanRef.current === decodedText) lastScanRef.current = null
          }, 2500)
        },
        () => {}
      )
      .catch(() => toast.error('Could not access camera. Check browser permissions.'))

    return () => {
      if (!stopped) {
        stopped = true
        scanner.stop().catch(() => {}).finally(() => scanner.clear().catch(() => {}))
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  return (
    <motion.div {...fadeIn} className="mx-auto max-w-2xl space-y-4">
      <Link to={`${basePath}/jobfair`} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-primary-700">
        <ArrowLeft className="h-4 w-4" /> Back to Job Fairs
      </Link>

      <Card>
        <CardContent>
          <h1 className="mb-3 text-lg font-semibold text-slate-900">QR Attendance Scanner</h1>
          <div id={SCANNER_ELEMENT_ID} className="mx-auto w-full max-w-sm overflow-hidden rounded-lg" />
          <p className="mt-3 text-center text-sm text-slate-500">
            Real-time attendance count: <span className="font-semibold text-primary-700">{scanCount}</span>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <h2 className="mb-2 text-sm font-semibold text-slate-800">Recent Scans</h2>
          {!recentScans.length ? (
            <p className="text-sm text-slate-400">No scans yet.</p>
          ) : (
            <ul className="space-y-1">
              {recentScans.map((s, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-slate-700">
                  <CheckCircle2 className="h-4 w-4 text-green-600" /> {s.jobseeker_name}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
