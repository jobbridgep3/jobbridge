import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ArrowLeft, Download, Trash2 } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { Button } from '../../components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Textarea } from '../../components/ui/Input'
import { CardSkeleton } from '../../components/ui/Skeleton'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { VacancyDisplay } from '../../components/vacancy/VacancyDisplay'
import api from '../../lib/axios'
import { downloadFile, parseBlobError } from '../../lib/download'
import { fadeIn } from '../../lib/motion'
import { formatSalaryRange } from '../../lib/salaryFormat'
import { canTransition } from '../../lib/vacancyStateMachine'
import { useAuthStore } from '../../store/authStore'

export default function StaffVacancyDetail({ basePath = '/staff' }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const role = useAuthStore((s) => s.user?.role)
  const [remarks, setRemarks] = useState('')
  const [confirmSuspend, setConfirmSuspend] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const { data: vacancy, isLoading } = useQuery({
    queryKey: ['staff', 'vacancies', id],
    queryFn: async () => (await api.get(`/api/staff/vacancies/${id}`)).data.data,
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['staff', 'vacancies', id] })

  const approve = useMutation({
    mutationFn: () => api.put(`/api/staff/vacancies/${id}/approve`),
    onSuccess: () => { toast.success('Vacancy approved.'); invalidate() },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not approve.'),
  })
  const reject = useMutation({
    mutationFn: () => api.put(`/api/staff/vacancies/${id}/reject`, { remarks }),
    onSuccess: () => { toast.success('Vacancy returned to employer.'); invalidate() },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not reject.'),
  })
  const suspend = useMutation({
    mutationFn: () => api.put(`/api/staff/vacancies/${id}/suspend`, { reason: remarks }),
    onSuccess: () => { toast.success('Vacancy suspended.'); setConfirmSuspend(false); invalidate() },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not suspend.'),
  })
  const reactivate = useMutation({
    mutationFn: () => api.put(`/api/staff/vacancies/${id}/reactivate`),
    onSuccess: () => { toast.success('Vacancy reactivated.'); invalidate() },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not reactivate.'),
  })
  const close = useMutation({
    mutationFn: () => api.put(`/api/staff/vacancies/${id}/close`),
    onSuccess: () => { toast.success('Vacancy closed.'); invalidate() },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not close.'),
  })

  const deleteVacancy = async () => {
    try {
      await api.delete(`/api/staff/vacancies/${id}`)
      toast.success('Vacancy deleted. It can be restored from the Admin panel.')
      queryClient.invalidateQueries({ queryKey: ['staff', 'vacancies'] })
      navigate(`${basePath}/vacancies`)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not delete vacancy.')
    } finally {
      setConfirmDelete(false)
    }
  }

  const downloadDetails = async () => {
    setDownloading(true)
    try {
      await downloadFile(`/api/staff/vacancies/${id}/applicants/export/excel`, { filename: `vacancy_${id}_applicants.xlsx` })
    } catch (err) {
      toast.error(await parseBlobError(err))
    } finally {
      setDownloading(false)
    }
  }

  if (isLoading || !vacancy) return <CardSkeleton />

  return (
    <motion.div {...fadeIn} className="mx-auto max-w-4xl space-y-4">
      <Link to={`${basePath}/vacancies`} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-primary-700">
        <ArrowLeft className="h-4 w-4" /> Back to Vacancies
      </Link>

      <Card>
        <CardContent>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-lg font-semibold text-slate-900">{vacancy.title}</h1>
              <p className="text-sm text-slate-500">{vacancy.company_name} • {vacancy.industry || 'No industry specified'}</p>
              <p className="mt-1 text-sm font-medium text-slate-700">{formatSalaryRange(vacancy.salary_min, vacancy.salary_max, vacancy.hide_salary)}</p>
            </div>
            <StatusBadge status={vacancy.status} />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {canTransition(vacancy.status, 'approved', role) && (
              <Button size="sm" onClick={() => approve.mutate()} disabled={approve.isPending}>Approve</Button>
            )}
            {canTransition(vacancy.status, 'rejected', role) && (
              <Button size="sm" variant="danger" onClick={() => reject.mutate()} disabled={reject.isPending || !remarks}>Reject</Button>
            )}
            {canTransition(vacancy.status, 'suspended', role) && (
              <Button size="sm" variant="secondary" onClick={() => setConfirmSuspend(true)}>Suspend</Button>
            )}
            {vacancy.status === 'suspended' && role === 'admin' && (
              <Button size="sm" onClick={() => reactivate.mutate()} disabled={reactivate.isPending}>Reactivate</Button>
            )}
            {canTransition(vacancy.status, 'closed', role) && (
              <Button size="sm" variant="secondary" onClick={() => close.mutate()} disabled={close.isPending}>Close</Button>
            )}
            <Button size="sm" variant="secondary" onClick={downloadDetails} disabled={downloading}>
              <Download className="h-3.5 w-3.5" /> Export Applicants
            </Button>
            {role === 'admin' && (
              <Button size="sm" variant="danger" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </Button>
            )}
          </div>

          {(vacancy.status === 'pending' || canTransition(vacancy.status, 'suspended', role)) && (
            <div className="mt-3">
              <Textarea placeholder="Remarks (required to reject/suspend)" value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} />
            </div>
          )}
        </CardContent>
      </Card>

      <VacancyDisplay vacancy={vacancy} company={vacancy.employer_company} hrProfile={vacancy.hr_profile} />

      <Card>
        <CardHeader><CardTitle>Hiring & Applicant Statistics</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div><span className="text-slate-400">Total Applicants:</span> {vacancy.hiring_stats?.total_applicants ?? 0}</div>
          <div><span className="text-slate-400">Hired:</span> {vacancy.hiring_stats?.hired ?? 0}</div>
          <div><span className="text-slate-400">Days Posted:</span> {vacancy.hiring_stats?.days_since_posted ?? '—'}</div>
          <div><span className="text-slate-400">Openings:</span> {vacancy.num_slots}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Applicants ({vacancy.applicants?.length || 0})</CardTitle></CardHeader>
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

      <Card>
        <CardHeader><CardTitle>Audit History</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {!vacancy.audit_history?.length ? (
            <p className="text-sm text-slate-400">No history yet.</p>
          ) : (
            vacancy.audit_history.map((h) => (
              <div key={h.id} className="border-b border-slate-100 py-2 text-sm last:border-0">
                <div className="flex items-center justify-between">
                  <span className="text-slate-700"><span className="font-medium">{h.action}</span> by {h.user_email || 'System'} {h.details ? `— ${h.details}` : ''}</span>
                  <span className="shrink-0 text-xs text-slate-400">{new Date(h.created_at).toLocaleString()}</span>
                </div>
                {(h.before_state || h.after_state) && (
                  <p className="mt-1 text-xs text-slate-400">
                    {h.before_state && `Before: ${JSON.stringify(h.before_state)} `}
                    {h.after_state && `After: ${JSON.stringify(h.after_state)}`}
                  </p>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmSuspend}
        onOpenChange={setConfirmSuspend}
        title="Suspend this vacancy?"
        description="It will be hidden from the public job listing until reactivated by an Admin."
        confirmLabel="Suspend"
        danger
        onConfirm={() => suspend.mutate()}
        loading={suspend.isPending}
      />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this vacancy?"
        description="It will be hidden from all listings. An Admin can restore it later."
        confirmLabel="Delete"
        danger
        onConfirm={deleteVacancy}
      />
    </motion.div>
  )
}
