import { useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { motion } from 'framer-motion'
import { Calendar, Check, FileDown, GraduationCap, MapPin, Upload } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'

import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { DocumentUploadSlot } from '../../components/ui/DocumentUploadSlot'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { CardSkeleton } from '../../components/ui/Skeleton'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { useSocket } from '../../hooks/useSocket'
import api from '../../lib/axios'
import { downloadFile, parseBlobError } from '../../lib/download'
import { fadeIn, staggerContainer, staggerItem } from '../../lib/motion'
import { cn } from '../../lib/utils'

const STEPS = [
  { key: 'registered', label: 'Registered' },
  { key: 'under_review', label: 'Under Review' },
  { key: 'for_orientation', label: 'For Orientation' },
  { key: 'attended_orientation', label: 'Attended Orientation' },
  { key: 'for_exam', label: 'For Exam' },
  { key: 'attended_exam', label: 'Attended Exam' },
  { key: 'result', label: 'Result' },
  { key: 'peso_appointment', label: 'PESO Appointment' },
]

const NEGATIVE_STATUSES = ['rejected', 'failed_orientation', 'failed']

// Orientation and Exam are fully symmetric on the backend (see models/spes.py):
// QR attendance automatically advances status to attended_orientation/attended_exam,
// and Staff then records a separate Passed/Failed result — so every step below maps
// directly to a real status value, no derivation from attendance logs needed.
function stepIndexFor(app) {
  switch (app.status) {
    case 'pending_review': return 1
    case 'rejected': return 1
    case 'approved_for_orientation': return 2
    case 'attended_orientation': return 3
    case 'failed_orientation': return 3
    case 'orientation_passed': return 4
    case 'attended_exam': return 5
    case 'failed': return 6
    case 'passed': return app.peso_appointment_at ? 7 : 6
    default: return 0
  }
}

function SpesStepper({ application }) {
  const currentIndex = stepIndexFor(application)
  const isNegative = NEGATIVE_STATUSES.includes(application.status)
  return (
    <ol className="flex items-center gap-1">
      {STEPS.map((step, i) => {
        const reached = i <= currentIndex
        const isCurrent = i === currentIndex
        const tone = reached ? (isNegative && isCurrent ? 'bg-red-600 text-white' : 'bg-primary-800 text-white') : 'bg-surface-hover text-text-muted'
        return (
          <li key={step.key} className="flex flex-1 items-center gap-1">
            <div className="flex flex-col items-center gap-1">
              <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold', tone)}>
                {reached && !isCurrent ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              <span className={cn('hidden text-center text-[9px] leading-tight sm:block', reached ? 'text-text-primary' : 'text-text-muted')}>
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && <div className={cn('h-0.5 flex-1', i < currentIndex ? 'bg-primary-800' : 'bg-surface-hover')} />}
          </li>
        )
      })}
    </ol>
  )
}

function ApplicationCard({ application, onChanged }) {
  const [downloading, setDownloading] = useState(false)

  const downloadPdf = async () => {
    setDownloading(true)
    try {
      await downloadFile(`/api/spes/${application.id}/form-pdf`, { filename: 'spes-application-form.pdf' })
    } catch (err) {
      toast.error(await parseBlobError(err))
    } finally {
      setDownloading(false)
    }
  }

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-text-primary">{application.batch_name}</p>
            <p className="text-xs text-text-muted">Ref. {application.application_ref_no} · Submitted {dayjs(application.submitted_at).format('MMM D, YYYY')}</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={application.status} />
            <Button size="sm" variant="secondary" onClick={downloadPdf} disabled={downloading}>
              <FileDown className="h-3.5 w-3.5" /> Application Form
            </Button>
          </div>
        </div>

        <SpesStepper application={application} />

        {application.status === 'rejected' && application.review_remarks && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">Rejected: {application.review_remarks}</p>
        )}
        {application.status === 'failed_orientation' && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            You did not proceed past orientation.{application.orientation_outcome_remarks ? ` ${application.orientation_outcome_remarks}` : ''}
          </p>
        )}
        {application.status === 'failed' && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            You were not selected after the exam.{application.exam_result_remarks ? ` ${application.exam_result_remarks}` : ''} We encourage you to apply for the next batch.
          </p>
        )}
        {application.status === 'passed' && (
          <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
            Congratulations — you passed the SPES examination! {!application.peso_appointment_at && 'Please wait for your PESO Office appointment details.'}
          </p>
        )}

        <DocumentUploadSlot
          label="Supporting Documents (optional)"
          required={false}
          multiple
          documents={(application.document_urls || []).map((d, i) => ({ id: i, file_url: d.url, original_filename: d.filename }))}
          onUpload={application.status === 'pending_review' ? async (file) => {
            const fd = new FormData()
            fd.append('file', file)
            try {
              await api.post(`/api/spes/${application.id}/documents`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
              toast.success('Document uploaded.')
              onChanged()
            } catch (err) {
              toast.error(err.response?.data?.message || 'Upload failed.')
            }
          } : undefined}
        />

        {application.status === 'passed' && (
          <div className="rounded-lg border border-border-subtle p-3">
            <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-text-primary"><MapPin className="h-4 w-4" /> PESO Office Appointment</p>
            {application.peso_appointment_at ? (
              <p className="text-sm text-text-secondary">{dayjs(application.peso_appointment_at).format('MMMM D, YYYY [at] h:mm A')} — PESO Pila Office</p>
            ) : (
              <p className="text-sm text-text-muted">Awaiting your PESO Office appointment — you'll be notified once it's scheduled.</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function JobseekerSPES() {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') === 'applications' ? 'applications' : 'batches'

  const { data: batches, isLoading: batchesLoading } = useQuery({
    queryKey: ['spes', 'batches'],
    queryFn: async () => (await api.get('/api/spes/batches')).data.data,
  })
  const { data: applications, isLoading: appsLoading } = useQuery({
    queryKey: ['spes', 'my'],
    queryFn: async () => (await api.get('/api/spes/my')).data.data,
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['spes', 'my'] })
  useSocket({ 'spes:status_change': invalidate })

  return (
    <motion.div {...fadeIn} className="space-y-4">
      <PageHeader title="SPES" description="Special Program for Employment of Students — register for an open batch and track your application through orientation, exam, and your PESO Office appointment." />

      <div className="flex w-fit rounded-lg border border-border bg-surface p-0.5">
        {[
          { key: 'batches', label: 'Available Batches' },
          { key: 'applications', label: 'My Applications' },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setSearchParams(t.key === 'batches' ? {} : { tab: t.key })}
            className={cn('rounded-md px-4 py-1.5 text-sm font-medium', tab === t.key ? 'bg-primary-800 text-white' : 'text-text-secondary hover:bg-surface-hover')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'batches' &&
        (batchesLoading ? (
          <CardSkeleton />
        ) : !batches?.length ? (
          <EmptyState icon={GraduationCap} title="No open SPES batches" description="You'll be notified when PESO opens a new batch." />
        ) : (
          <motion.div variants={staggerContainer} initial="initial" animate="animate" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {batches.map((batch) => (
              <motion.div key={batch.id} variants={staggerItem}>
                <Link to={`/jobseeker/spes/${batch.id}`}>
                  <Card hover className="cursor-pointer">
                    <CardHeader><CardTitle>{batch.batch_name}</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                      <p className="line-clamp-2 text-sm text-text-secondary">{batch.description}</p>
                      <p className="flex items-center gap-1.5 text-xs text-text-muted">
                        <Calendar className="h-3.5 w-3.5" /> Register by {dayjs(batch.registration_deadline).format('MMM D, YYYY')}
                      </p>
                      <ProgressBar percent={Math.round((batch.current_applicants / batch.total_slots) * 100)} label={`${batch.slots_remaining} slot(s) remaining`} compact />
                      {batch.is_full && <Badge variant="danger">Full</Badge>}
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        ))}

      {tab === 'applications' &&
        (appsLoading ? (
          <CardSkeleton />
        ) : !applications?.length ? (
          <EmptyState icon={Upload} title="No applications yet" description="Register for an open batch to get started." />
        ) : (
          <div className="space-y-4">
            {applications.map((app) => <ApplicationCard key={app.id} application={app} onChanged={invalidate} />)}
          </div>
        ))}
    </motion.div>
  )
}
