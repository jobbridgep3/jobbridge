import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import toast from 'react-hot-toast'
import { Link, useParams } from 'react-router-dom'

import { Button } from '../../components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { CardSkeleton } from '../../components/ui/Skeleton'
import { StatusBadge } from '../../components/ui/StatusBadge'
import api from '../../lib/axios'
import { fadeIn } from '../../lib/motion'

export default function StaffEmployerDetail({ basePath = '/staff' }) {
  const { id } = useParams()
  const queryClient = useQueryClient()

  const { data: company, isLoading } = useQuery({
    queryKey: ['staff', 'employers', id],
    queryFn: async () => (await api.get(`/api/staff/employers/${id}`)).data.data,
  })

  const verify = useMutation({
    mutationFn: (approve) => api.put(`/api/staff/employers/${id}/verify`, { approve }),
    onSuccess: () => {
      toast.success('Employer verification updated.')
      queryClient.invalidateQueries({ queryKey: ['staff', 'employers', id] })
    },
  })

  const suspend = useMutation({
    mutationFn: () => api.put(`/api/staff/employers/${id}/suspend`),
    onSuccess: () => {
      toast.success('Employer suspended.')
      queryClient.invalidateQueries({ queryKey: ['staff', 'employers', id] })
    },
  })

  if (isLoading || !company) return <CardSkeleton />

  return (
    <motion.div {...fadeIn} className="mx-auto max-w-3xl space-y-4">
      <Link to={`${basePath}/employers`} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-primary-700">
        <ArrowLeft className="h-4 w-4" /> Back to Employers
      </Link>

      <Card>
        <CardContent className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">{company.company_name}</h1>
            <p className="text-sm text-slate-500">{company.email}</p>
            <p className="text-sm text-slate-500">{company.industry} • {company.business_permit_no}</p>
            <div className="mt-2">
              <StatusBadge status={company.verification_status} />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Button size="sm" onClick={() => verify.mutate(true)} disabled={company.verification_status === 'verified'}>
              Approve Verification
            </Button>
            <Button size="sm" variant="secondary" onClick={() => verify.mutate(false)}>
              Reject Verification
            </Button>
            <Button size="sm" variant="danger" onClick={() => suspend.mutate()}>
              Suspend Account
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vacancies Posted</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {!company.vacancies?.length ? (
            <p className="text-sm text-slate-400">No vacancies posted.</p>
          ) : (
            company.vacancies.map((v) => (
              <div key={v.id} className="flex items-center justify-between border-b border-slate-100 py-2 last:border-0">
                <span className="text-sm text-slate-700">{v.title}</span>
                <StatusBadge status={v.status} />
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
