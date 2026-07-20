import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { Html5Qrcode } from 'html5-qrcode'
import { motion } from 'framer-motion'
import { ArrowLeft, BadgeCheck, CheckCircle2, FileText, KeyRound, UserCheck, Users } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { Button } from '../../components/ui/Button'
import { Card, CardContent } from '../../components/ui/Card'
import { Input, Select } from '../../components/ui/Input'
import { CardSkeleton } from '../../components/ui/Skeleton'
import { StatCard } from '../../components/ui/StatCard'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { useSocket } from '../../hooks/useSocket'
import api from '../../lib/axios'
import { fadeIn } from '../../lib/motion'

const SCANNER_ELEMENT_ID = 'booth-qr-scanner'

function VisitorRow({ visit, jobfairId, vacancies, onLinked }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [picking, setPicking] = useState(false)
  const [vacancyId, setVacancyId] = useState('')

  const linkVacancy = useMutation({
    mutationFn: () => api.post(`/api/jobfair/${jobfairId}/booth/visitors/${visit.id}/link-vacancy`, { vacancy_id: vacancyId }),
    onSuccess: (res) => {
      toast.success(res.data?.message || 'Applicant linked.')
      queryClient.invalidateQueries({ queryKey: ['jobfair', jobfairId, 'booth', 'visitors'] })
      onLinked?.(res.data.data.application_id)
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not link applicant.'),
  })

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium text-slate-800">{visit.jobseeker_name}</p>
          {visit.is_verified_by_staff && <BadgeCheck className="h-3.5 w-3.5 text-primary-600" title="PESO Verified" />}
        </div>
        <p className="text-xs text-slate-500">
          {visit.preferred_position || 'No preferred position listed'}
          {visit.municipality ? ` · ${visit.municipality}` : ''}
        </p>
        <p className="text-xs text-slate-400">Registered {dayjs(visit.created_at).format('MMM D, h:mm A')}</p>
      </div>
      <div className="flex items-center gap-2">
        {visit.resume_url && (
          <Button size="sm" variant="ghost" onClick={() => window.open(visit.resume_url, '_blank')}>
            <FileText className="h-3.5 w-3.5" /> Resume
          </Button>
        )}
        <StatusBadge status={visit.checked_in ? 'checked_in' : 'not_arrived'} />
        {visit.application_id ? (
          <>
            <StatusBadge status={visit.application_status} label={visit.application_status_label} />
            <Button size="sm" variant="secondary" onClick={() => navigate(`/employer/applicants/${visit.application_id}`)}>
              Manage Applicant
            </Button>
          </>
        ) : picking ? (
          <>
            <Select value={vacancyId} onChange={(e) => setVacancyId(e.target.value)} className="w-48">
              <option value="">Select a vacancy…</option>
              {vacancies.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.title}
                </option>
              ))}
            </Select>
            <Button size="sm" disabled={!vacancyId || linkVacancy.isPending} onClick={() => linkVacancy.mutate()}>
              {linkVacancy.isPending ? 'Linking…' : 'Confirm'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setPicking(false)}>
              Cancel
            </Button>
          </>
        ) : (
          <Button size="sm" variant="secondary" disabled={!vacancies.length} onClick={() => setPicking(true)}>
            Manage Applicant
          </Button>
        )}
      </div>
    </div>
  )
}

export default function EmployerJobFairBooth() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const scannerRef = useRef(null)
  const lastScanRef = useRef(null)
  const [manualToken, setManualToken] = useState('')

  const { data, isLoading, error } = useQuery({
    queryKey: ['jobfair', id, 'booth', 'visitors'],
    queryFn: async () => (await api.get(`/api/jobfair/${id}/booth/visitors`)).data.data,
    retry: false,
  })
  const { data: myVacancies } = useQuery({
    queryKey: ['vacancies', 'my'],
    queryFn: async () => (await api.get('/api/vacancies/my')).data.data,
  })
  const publishedVacancies = (myVacancies || []).filter((v) => v.status === 'published')

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['jobfair', id, 'booth', 'visitors'] })

  useSocket({
    'jobfair:booth_visit': (payload) => {
      if (String(payload.jobfair_id) !== String(id)) return
      refresh()
    },
  })

  const submitToken = async (token) => {
    try {
      const res = await api.post(`/api/jobfair/${id}/booth/scan-qr`, { qr_token: token })
      toast.success(res.data.message || 'Checked in.')
      refresh()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid QR code or not registered for your booth.')
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

  const visitors = data?.visitors || []
  const checkedInCount = visitors.filter((v) => v.checked_in).length

  return (
    <motion.div {...fadeIn} className="mx-auto max-w-3xl space-y-4">
      <Link to="/employer/jobfair" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-primary-700">
        <ArrowLeft className="h-4 w-4" /> Back to Job Fairs
      </Link>

      {isLoading ? (
        <CardSkeleton />
      ) : error ? (
        <Card>
          <CardContent>
            <p className="py-4 text-center text-sm text-slate-500">
              {error.response?.data?.message || 'Could not load your booth.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4">
            <StatCard label="Registered" value={visitors.length} icon={Users} tone="primary" />
            <StatCard label="Checked In" value={checkedInCount} icon={UserCheck} tone="success" />
          </div>

          <Card>
            <CardContent>
              <h1 className="mb-3 text-lg font-semibold text-slate-900">My Booth — {data.booth.booth_name || data.booth.company_name}</h1>
              <div id={SCANNER_ELEMENT_ID} className="mx-auto w-full max-w-sm overflow-hidden rounded-lg" />
              <div className="mx-auto mt-4 flex max-w-sm gap-2">
                <Input
                  placeholder="Or enter the jobseeker's QR token manually…"
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
                  <KeyRound className="h-3.5 w-3.5" /> Check In
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <h2 className="mb-2 text-sm font-semibold text-slate-800">Registered Jobseekers</h2>
              {!visitors.length ? (
                <p className="py-6 text-center text-sm text-slate-500">No one has registered for your booth yet.</p>
              ) : (
                <div className="space-y-2">
                  {visitors.map((v) => (
                    <VisitorRow
                      key={v.id}
                      visit={v}
                      jobfairId={id}
                      vacancies={publishedVacancies}
                      onLinked={(applicationId) => navigate(`/employer/applicants/${applicationId}`)}
                    />
                  ))}
                </div>
              )}
              {!publishedVacancies.length && visitors.some((v) => !v.application_id) && (
                <p className="mt-3 flex items-center gap-1.5 text-xs text-amber-600">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Publish a vacancy to start managing applicants from this booth.
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </motion.div>
  )
}
