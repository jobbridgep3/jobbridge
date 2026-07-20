import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { motion } from 'framer-motion'
import { ArrowLeft, Building2, CalendarDays, FileDown, MapPinned, Paperclip, Phone, User } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { Link, useParams } from 'react-router-dom'

import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card, CardContent } from '../../components/ui/Card'
import { CardSkeleton } from '../../components/ui/Skeleton'
import api from '../../lib/axios'
import { downloadFile, parseBlobError } from '../../lib/download'
import { fadeIn } from '../../lib/motion'

function DetailRow({ icon: Icon, label, children }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <div className="font-medium text-slate-800">{children}</div>
      </div>
    </div>
  )
}

export default function JobseekerJobFairDetail() {
  const { id } = useParams()
  const queryClient = useQueryClient()
  const [downloading, setDownloading] = useState(false)

  const { data: fair, isLoading } = useQuery({
    queryKey: ['jobfair', id],
    queryFn: async () => (await api.get(`/api/jobfair/${id}`)).data.data,
  })

  const registerMutation = useMutation({
    mutationFn: () => api.post(`/api/jobfair/${id}/register`),
    onSuccess: (res) => {
      toast.success(res.data?.message || 'Registered!')
      queryClient.invalidateQueries({ queryKey: ['jobfair'] })
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not register.'),
  })

  const [visitingBoothId, setVisitingBoothId] = useState(null)
  const visitBoothMutation = useMutation({
    mutationFn: (boothId) => api.post(`/api/jobfair/${id}/booths/${boothId}/visit`),
    onMutate: (boothId) => setVisitingBoothId(boothId),
    onSuccess: (res) => {
      toast.success(res.data?.message || 'Registered for this booth!')
      queryClient.invalidateQueries({ queryKey: ['jobfair', id] })
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not register for this booth.'),
    onSettled: () => setVisitingBoothId(null),
  })

  const downloadForm = async () => {
    setDownloading(true)
    try {
      await downloadFile(`/api/jobfair/${id}/registration-form/pdf`, { filename: 'jobfair-registration.pdf' })
    } catch (err) {
      toast.error(await parseBlobError(err))
    } finally {
      setDownloading(false)
    }
  }

  if (isLoading || !fair) return <CardSkeleton />

  const registration = fair.my_registration
  const canRegister =
    !registration &&
    ['published', 'ongoing'].includes(fair.status) &&
    (!fair.registration_deadline || dayjs().isBefore(dayjs(fair.registration_deadline)))

  return (
    <motion.div {...fadeIn} className="mx-auto max-w-3xl space-y-4">
      <Link to="/jobseeker/jobfair" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-primary-700">
        <ArrowLeft className="h-4 w-4" /> Back to Job Fairs
      </Link>

      <Card className="overflow-hidden">
        {fair.banner_url && <img src={fair.banner_url} alt={fair.name} className="aspect-[16/9] w-full bg-slate-100 object-contain" />}
        <CardContent className="space-y-5">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">{fair.name}</h1>
            {fair.description && <p className="mt-1 text-sm text-slate-600">{fair.description}</p>}
          </div>

          <div className="grid grid-cols-1 gap-3 rounded-lg bg-slate-50 p-4 sm:grid-cols-2">
            <DetailRow icon={CalendarDays} label="Date & Time">
              {dayjs(fair.event_date).format('MMMM D, YYYY h:mm A')}
              {fair.end_time ? ` – ${dayjs(fair.end_time).format('h:mm A')}` : ''}
            </DetailRow>
            <DetailRow icon={MapPinned} label="Venue">
              {fair.venue}
              {fair.municipality ? `, ${fair.municipality}` : ''}
            </DetailRow>
            {fair.registration_deadline && (
              <DetailRow icon={CalendarDays} label="Registration Deadline">
                {dayjs(fair.registration_deadline).format('MMMM D, YYYY h:mm A')}
              </DetailRow>
            )}
            {fair.contact_person && (
              <DetailRow icon={User} label="Contact Person">
                {fair.contact_person}
              </DetailRow>
            )}
            {fair.contact_number && (
              <DetailRow icon={Phone} label="Contact Number">
                {fair.contact_number}
              </DetailRow>
            )}
            <DetailRow icon={Building2} label="Participation">
              {fair.registered_employers} employers · {fair.registered_jobseekers} jobseekers registered
            </DetailRow>
          </div>

          {fair.requirements && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-semibold text-amber-800">What to bring</p>
              <p className="mt-0.5 text-sm text-amber-900">{fair.requirements}</p>
            </div>
          )}

          {fair.attachments?.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-semibold text-slate-800">Attachments</h2>
              <div className="space-y-1">
                {fair.attachments.map((a, i) => (
                  <a
                    key={i}
                    href={a.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 text-sm text-primary-700 hover:underline"
                  >
                    <Paperclip className="h-3.5 w-3.5" /> {a.name}
                  </a>
                ))}
              </div>
            </div>
          )}

          <div>
            <h2 className="mb-2 text-sm font-semibold text-slate-800">Participating Employers</h2>
            {fair.booths?.length ? (
              <div className="space-y-2">
                {fair.booths.map((b) => {
                  const visited = fair.visited_booth_ids?.includes(b.id)
                  return (
                    <div key={b.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 p-3">
                      <div>
                        <p className="text-sm font-medium text-slate-800">{b.booth_name || b.company_name}</p>
                        {b.description && <p className="text-xs text-slate-500">{b.description}</p>}
                      </div>
                      {visited ? (
                        <Badge variant="success">Registered ✓</Badge>
                      ) : registration ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={visitBoothMutation.isPending && visitingBoothId === b.id}
                          onClick={() => visitBoothMutation.mutate(b.id)}
                        >
                          {visitBoothMutation.isPending && visitingBoothId === b.id ? 'Registering…' : 'Register to Booth'}
                        </Button>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-400">No employers registered yet.</p>
            )}
          </div>

          {fair.vacancies?.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-semibold text-slate-800">Available Vacancies</h2>
              <div className="space-y-2">
                {fair.vacancies.map((v) => (
                  <Link
                    key={v.id}
                    to={`/jobseeker/jobs/${v.id}`}
                    className="flex items-center justify-between rounded-lg border border-slate-200 p-3 hover:border-primary-300 hover:bg-primary-50/40"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-800">{v.title}</p>
                      <p className="text-xs text-slate-500">{v.company_name}</p>
                    </div>
                    {v.job_type && <Badge className="capitalize">{v.job_type.replace(/_/g, ' ')}</Badge>}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {registration ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-primary-100 bg-primary-50 p-6 text-center">
              <p className="text-sm font-medium text-primary-900">
                You're registered! Registration No. <b>{registration.registration_number}</b>
              </p>
              <img src={registration.qr_data_url} alt="Your QR code" className="h-40 w-40" />
              <p className="text-xs text-primary-800">Show this QR code at the venue for attendance.</p>
              <Button size="sm" variant="secondary" onClick={downloadForm} disabled={downloading}>
                <FileDown className="h-3.5 w-3.5" /> {downloading ? 'Downloading…' : 'Download Registration Form'}
              </Button>
              {registration.attended && (
                <p className="text-xs font-medium text-emerald-700">
                  ✓ Attendance recorded {registration.scanned_at ? dayjs(registration.scanned_at).format('MMM D, h:mm A') : ''}
                </p>
              )}
            </div>
          ) : canRegister ? (
            <div className="flex justify-end border-t border-slate-100 pt-4">
              <Button onClick={() => registerMutation.mutate()} disabled={registerMutation.isPending}>
                {registerMutation.isPending ? 'Registering…' : 'Register for this Job Fair'}
              </Button>
            </div>
          ) : (
            <p className="border-t border-slate-100 pt-4 text-center text-sm text-slate-500">
              {fair.status === 'completed' ? 'This job fair has ended.' : 'Registration for this job fair is closed.'}
            </p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
