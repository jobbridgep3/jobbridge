import { useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { motion } from 'framer-motion'
import { CalendarDays, FileDown, MapPinned, QrCode } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { Link } from 'react-router-dom'

import { Button } from '../../components/ui/Button'
import { Card, CardContent } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { CardSkeleton } from '../../components/ui/Skeleton'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { useSocket } from '../../hooks/useSocket'
import api from '../../lib/axios'
import { downloadFile, parseBlobError } from '../../lib/download'
import { fadeIn, staggerContainer, staggerItem } from '../../lib/motion'
import { cn } from '../../lib/utils'

function fairChip(fair) {
  if (fair.status === 'published' && dayjs(fair.event_date).isAfter(dayjs())) return { status: 'upcoming' }
  return { status: fair.status }
}

export default function JobseekerJobFair() {
  const queryClient = useQueryClient()
  const [view, setView] = useState('upcoming')
  const [downloading, setDownloading] = useState(null)

  const { data: fairs, isLoading } = useQuery({
    queryKey: ['jobfair'],
    queryFn: async () => (await api.get('/api/jobfair')).data.data,
  })
  const { data: registrations, isLoading: regsLoading } = useQuery({
    queryKey: ['jobfair', 'my-registrations'],
    queryFn: async () => (await api.get('/api/jobfair/my-registrations')).data.data,
  })

  useSocket({
    'jobfair:published': () => queryClient.invalidateQueries({ queryKey: ['jobfair'] }),
    'jobfair:updated': () => queryClient.invalidateQueries({ queryKey: ['jobfair'] }),
  })

  const downloadForm = async (jobfairId) => {
    setDownloading(jobfairId)
    try {
      await downloadFile(`/api/jobfair/${jobfairId}/registration-form/pdf`, { filename: 'jobfair-registration.pdf' })
    } catch (err) {
      toast.error(await parseBlobError(err))
    } finally {
      setDownloading(null)
    }
  }

  return (
    <motion.div {...fadeIn} className="space-y-4">
      <PageHeader title="Job Fair" description="View, register for, and attend PESO-organized job fairs." />

      <div className="flex w-fit rounded-lg border border-slate-200 bg-white p-0.5">
        {[
          { key: 'upcoming', label: 'Job Fairs' },
          { key: 'registrations', label: 'My Registrations' },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setView(t.key)}
            className={cn(
              'rounded-md px-4 py-1.5 text-sm font-medium',
              view === t.key ? 'bg-primary-800 text-white' : 'text-slate-600 hover:bg-slate-100',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {view === 'upcoming' &&
        (isLoading ? (
          <CardSkeleton />
        ) : !fairs?.length ? (
          <EmptyState icon={MapPinned} title="No job fairs scheduled" description="You'll be notified when PESO announces a new job fair." />
        ) : (
          <motion.div variants={staggerContainer} initial="initial" animate="animate" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {fairs.map((fair) => (
              <motion.div key={fair.id} variants={staggerItem}>
                <Card hover className="overflow-hidden">
                  <Link to={`/jobseeker/jobfair/${fair.id}`} className="block">
                    {fair.banner_url && <img src={fair.banner_url} alt={fair.name} className="h-28 w-full object-cover" />}
                    <div className="p-5">
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <h3 className="text-sm font-semibold text-slate-900">{fair.name}</h3>
                        <StatusBadge {...fairChip(fair)} />
                      </div>
                      <p className="flex items-center gap-1.5 text-xs text-slate-500">
                        <CalendarDays className="h-3.5 w-3.5" /> {dayjs(fair.event_date).format('MMM D, YYYY h:mm A')}
                      </p>
                      <p className="flex items-center gap-1.5 text-xs text-slate-500">
                        <MapPinned className="h-3.5 w-3.5" /> {fair.venue}
                        {fair.municipality ? `, ${fair.municipality}` : ''}
                      </p>
                      {fair.registration_deadline && (
                        <p className="mt-1 text-xs text-amber-600">Register by {dayjs(fair.registration_deadline).format('MMM D, YYYY')}</p>
                      )}
                      <p className="mt-2 text-xs text-slate-500">
                        {fair.registered_employers} employers · {fair.registered_jobseekers} registered
                      </p>
                    </div>
                  </Link>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        ))}

      {view === 'registrations' &&
        (regsLoading ? (
          <CardSkeleton />
        ) : !registrations?.length ? (
          <EmptyState icon={QrCode} title="No registrations yet" description="Register for a job fair and your registrations will appear here." />
        ) : (
          <div className="space-y-3">
            {registrations.map((reg) => (
              <Card key={reg.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{reg.jobfair_name}</p>
                    <p className="text-xs text-slate-500">
                      {reg.registration_number} · {dayjs(reg.event_date).format('MMM D, YYYY h:mm A')}
                    </p>
                    {reg.attended && reg.scanned_at && (
                      <p className="text-xs text-emerald-600">Attended — scanned {dayjs(reg.scanned_at).format('MMM D, YYYY h:mm A')}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={reg.attended ? 'attended' : 'accepted'} label={reg.attended ? 'Attended' : 'Registered'} />
                    <Button size="sm" variant="secondary" onClick={() => downloadForm(reg.jobfair_id)} disabled={downloading === reg.jobfair_id}>
                      <FileDown className="h-3.5 w-3.5" /> Registration Form
                    </Button>
                    <Button size="sm" variant="secondary" asChild>
                      <Link to={`/jobseeker/jobfair/${reg.jobfair_id}`}>View Event</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ))}
    </motion.div>
  )
}
