import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ArrowLeft, Trash2 } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { Button } from '../../components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { CardSkeleton } from '../../components/ui/Skeleton'
import { StatusBadge } from '../../components/ui/StatusBadge'
import api from '../../lib/axios'
import { fadeIn } from '../../lib/motion'
import { useAuthStore } from '../../store/authStore'

export default function StaffEmployerDetail({ basePath = '/staff' }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const role = useAuthStore((s) => s.user?.role)
  const [confirmVerify, setConfirmVerify] = useState(null) // true | false | null
  const [confirmSuspend, setConfirmSuspend] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const { data: company, isLoading } = useQuery({
    queryKey: ['staff', 'employers', id],
    queryFn: async () => (await api.get(`/api/staff/employers/${id}`)).data.data,
  })

  const verify = useMutation({
    mutationFn: (approve) => api.put(`/api/staff/employers/${id}/verify`, { approve }),
    onSuccess: () => {
      toast.success('Employer verification updated.')
      setConfirmVerify(null)
      queryClient.invalidateQueries({ queryKey: ['staff', 'employers', id] })
    },
  })

  const suspend = useMutation({
    mutationFn: () => api.put(`/api/staff/employers/${id}/suspend`),
    onSuccess: () => {
      toast.success('Employer suspended.')
      setConfirmSuspend(false)
      queryClient.invalidateQueries({ queryKey: ['staff', 'employers', id] })
    },
  })

  const deleteAccount = async () => {
    setDeleting(true)
    try {
      await api.delete(`/api/staff/employers/${id}`)
      toast.success('Employer account permanently deleted.')
      queryClient.invalidateQueries({ queryKey: ['staff', 'employers'] })
      navigate(`${basePath}/employers`)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not delete this account.')
    } finally {
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

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
            <Button size="sm" onClick={() => setConfirmVerify(true)} disabled={company.verification_status === 'verified'}>
              Approve Verification
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setConfirmVerify(false)}>
              Reject Verification
            </Button>
            <Button size="sm" variant="danger" onClick={() => setConfirmSuspend(true)}>
              Suspend Account
            </Button>
            {role === 'admin' && (
              <Button size="sm" variant="danger" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="h-3.5 w-3.5" /> Delete Permanently
              </Button>
            )}
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

      <ConfirmDialog
        open={confirmVerify !== null}
        onOpenChange={(open) => !open && setConfirmVerify(null)}
        title={confirmVerify ? 'Approve this employer?' : 'Reject this employer?'}
        description={
          confirmVerify
            ? 'The employer will be marked as verified and can post job vacancies.'
            : 'The employer will be marked as unverified.'
        }
        confirmLabel={confirmVerify ? 'Approve' : 'Reject'}
        danger={!confirmVerify}
        onConfirm={() => verify.mutate(confirmVerify)}
        loading={verify.isPending}
      />

      <ConfirmDialog
        open={confirmSuspend}
        onOpenChange={setConfirmSuspend}
        title="Suspend this account?"
        description="The employer will immediately lose the ability to log in or manage vacancies."
        confirmLabel="Suspend"
        danger
        onConfirm={() => suspend.mutate()}
        loading={suspend.isPending}
      />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete Account"
        description="Are you sure you want to permanently delete this account? This action cannot be undone."
        confirmLabel="Delete Permanently"
        danger
        onConfirm={deleteAccount}
        loading={deleting}
      />
    </motion.div>
  )
}
