import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ArrowLeft, FileText, ShieldCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import { Link, useParams } from 'react-router-dom'

import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { CardSkeleton } from '../../components/ui/Skeleton'
import { StatusBadge } from '../../components/ui/StatusBadge'
import api from '../../lib/axios'
import { fadeIn } from '../../lib/motion'

export default function StaffJobseekerDetail({ basePath = '/staff' }) {
  const { id } = useParams()
  const queryClient = useQueryClient()

  const { data: profile, isLoading } = useQuery({
    queryKey: ['staff', 'jobseekers', id],
    queryFn: async () => (await api.get(`/api/staff/jobseekers/${id}`)).data.data,
  })

  const verify = useMutation({
    mutationFn: () => api.put(`/api/staff/jobseekers/${id}/verify`),
    onSuccess: () => {
      toast.success('Jobseeker verified.')
      queryClient.invalidateQueries({ queryKey: ['staff', 'jobseekers', id] })
    },
  })

  const toggleActive = useMutation({
    mutationFn: () => api.put(`/api/staff/jobseekers/${id}/deactivate`),
    onSuccess: () => {
      toast.success('Account status updated.')
      queryClient.invalidateQueries({ queryKey: ['staff', 'jobseekers', id] })
    },
  })

  if (isLoading || !profile) return <CardSkeleton />

  return (
    <motion.div {...fadeIn} className="mx-auto max-w-3xl space-y-4">
      <Link to={`${basePath}/jobseekers`} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-primary-700">
        <ArrowLeft className="h-4 w-4" /> Back to Jobseekers
      </Link>

      <Card>
        <CardContent className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">{profile.full_name}</h1>
            <p className="text-sm text-slate-500">{profile.email}</p>
            <p className="text-sm text-slate-500">{profile.contact_number}</p>
            <div className="mt-2 flex gap-2">
              <Badge variant={profile.is_verified_by_staff ? 'success' : 'default'}>{profile.is_verified_by_staff ? 'Verified' : 'Unverified'}</Badge>
              {(profile.tags || []).map((t) => (
                <Badge key={t} variant="primary">{t}</Badge>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {!profile.is_verified_by_staff && (
              <Button size="sm" onClick={() => verify.mutate()}>
                <ShieldCheck className="h-3.5 w-3.5" /> Verify Account
              </Button>
            )}
            <Button size="sm" variant="secondary" onClick={() => toggleActive.mutate()}>
              Toggle Active Status
            </Button>
            {profile.resume_url && (
              <Button size="sm" variant="secondary" onClick={() => window.open(profile.resume_url, '_blank')}>
                <FileText className="h-3.5 w-3.5" /> Resume
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Skills & Experience</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {(profile.skills || []).map((s) => (
              <Badge key={s}>{s}</Badge>
            ))}
          </div>
          {profile.work_experiences?.map((w, i) => (
            <p key={i} className="text-sm text-slate-600">
              {w.position} — {w.company}
            </p>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Applications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {!profile.applications?.length ? (
            <p className="text-sm text-slate-400">No applications submitted.</p>
          ) : (
            profile.applications.map((a) => (
              <div key={a.id} className="flex items-center justify-between border-b border-slate-100 py-2 last:border-0">
                <span className="text-sm text-slate-700">{a.job_title} — {a.company_name}</span>
                <StatusBadge status={a.status} />
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
