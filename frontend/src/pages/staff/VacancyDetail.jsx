import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { Link, useParams } from 'react-router-dom'

import { Button } from '../../components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { Textarea } from '../../components/ui/Input'
import { CardSkeleton } from '../../components/ui/Skeleton'
import { StatusBadge } from '../../components/ui/StatusBadge'
import api from '../../lib/axios'
import { fadeIn } from '../../lib/motion'

export default function StaffVacancyDetail({ basePath = '/staff' }) {
  const { id } = useParams()
  const queryClient = useQueryClient()
  const [remarks, setRemarks] = useState('')

  const { data: vacancy, isLoading } = useQuery({
    queryKey: ['staff', 'vacancies', id],
    queryFn: async () => (await api.get(`/api/staff/vacancies/${id}`)).data.data,
  })

  const approve = useMutation({
    mutationFn: () => api.put(`/api/staff/vacancies/${id}/approve`),
    onSuccess: () => {
      toast.success('Vacancy approved.')
      queryClient.invalidateQueries({ queryKey: ['staff', 'vacancies', id] })
    },
  })

  const reject = useMutation({
    mutationFn: () => api.put(`/api/staff/vacancies/${id}/reject`, { remarks }),
    onSuccess: () => {
      toast.success('Vacancy returned to employer.')
      queryClient.invalidateQueries({ queryKey: ['staff', 'vacancies', id] })
    },
  })

  if (isLoading || !vacancy) return <CardSkeleton />

  return (
    <motion.div {...fadeIn} className="mx-auto max-w-3xl space-y-4">
      <Link to={`${basePath}/vacancies`} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-primary-700">
        <ArrowLeft className="h-4 w-4" /> Back to Vacancies
      </Link>

      <Card>
        <CardContent>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-lg font-semibold text-slate-900">{vacancy.title}</h1>
              <p className="text-sm text-slate-500">{vacancy.company_name}</p>
            </div>
            <StatusBadge status={vacancy.status} />
          </div>
          <p className="mt-4 whitespace-pre-line text-sm text-slate-600">{vacancy.description}</p>
          {vacancy.requirements && <p className="mt-3 whitespace-pre-line text-sm text-slate-600">{vacancy.requirements}</p>}
        </CardContent>
      </Card>

      {vacancy.status === 'pending' && (
        <Card>
          <CardHeader>
            <CardTitle>Review Decision</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea placeholder="Remarks (required if rejecting)" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
            <div className="flex gap-2">
              <Button onClick={() => approve.mutate()} disabled={approve.isPending}>
                Approve
              </Button>
              <Button variant="danger" onClick={() => reject.mutate()} disabled={reject.isPending || !remarks}>
                Reject
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Applicants ({vacancy.applicants?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {!vacancy.applicants?.length ? (
            <p className="text-sm text-slate-400">No applicants yet.</p>
          ) : (
            vacancy.applicants.map((a) => (
              <div key={a.id} className="flex items-center justify-between border-b border-slate-100 py-2 last:border-0">
                <span className="text-sm text-slate-700">{a.jobseeker_name}</span>
                <StatusBadge status={a.status} />
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
