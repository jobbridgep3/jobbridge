import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import toast from 'react-hot-toast'
import { Link, useParams } from 'react-router-dom'

import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card, CardContent } from '../../components/ui/Card'
import { CardSkeleton } from '../../components/ui/Skeleton'
import api from '../../lib/axios'
import { fadeIn } from '../../lib/motion'

export default function JobseekerJobFairDetail() {
  const { id } = useParams()
  const queryClient = useQueryClient()

  const { data: fair, isLoading } = useQuery({
    queryKey: ['jobfair', id],
    queryFn: async () => (await api.get(`/api/jobfair/${id}`)).data.data,
  })

  const registerMutation = useMutation({
    mutationFn: () => api.post(`/api/jobfair/${id}/register`),
    onSuccess: (res) => {
      toast.success('Registered! QR code emailed to you.')
      queryClient.setQueryData(['jobfair', id, 'registration'], res.data.data)
      queryClient.invalidateQueries({ queryKey: ['jobfair', id] })
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not register.'),
  })

  if (isLoading || !fair) return <CardSkeleton />

  const registration = registerMutation.data?.data.data

  return (
    <motion.div {...fadeIn} className="mx-auto max-w-2xl space-y-4">
      <Link to="/jobseeker/jobfair" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-primary-700">
        <ArrowLeft className="h-4 w-4" /> Back to Job Fairs
      </Link>

      <Card>
        <CardContent className="space-y-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">{fair.name}</h1>
            <p className="text-sm text-slate-500">{fair.venue}</p>
            <p className="text-sm text-slate-500">{dayjs(fair.event_date).format('MMMM D, YYYY h:mm A')}</p>
          </div>
          {fair.description && <p className="text-sm text-slate-600">{fair.description}</p>}

          <div>
            <h2 className="mb-2 text-sm font-semibold text-slate-800">Participating Employers</h2>
            <div className="flex flex-wrap gap-2">
              {fair.booths?.length ? (
                fair.booths.map((b) => <Badge key={b.id}>{b.company_name}</Badge>)
              ) : (
                <p className="text-sm text-slate-400">No employers registered yet.</p>
              )}
            </div>
          </div>

          {registration ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-primary-100 bg-primary-50 p-6 text-center">
              <p className="text-sm font-medium text-primary-900">You're registered! Show this QR code at the venue.</p>
              <img src={registration.qr_data_url} alt="Your QR code" className="h-40 w-40" />
            </div>
          ) : (
            <div className="flex justify-end border-t border-slate-100 pt-4">
              <Button onClick={() => registerMutation.mutate()} disabled={registerMutation.isPending}>
                {registerMutation.isPending ? 'Registering…' : 'Register for this Job Fair'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
