import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { useState } from 'react'
import toast from 'react-hot-toast'

import { Button } from '../../components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { useConfirmDialog } from '../../components/ui/ConfirmDialog'
import { DatePicker } from '../../components/ui/DatePicker'
import { Dialog, DialogContent } from '../../components/ui/Dialog'
import { EmptyState } from '../../components/ui/EmptyState'
import { Input, Label, Select, Textarea } from '../../components/ui/Input'
import { CardSkeleton } from '../../components/ui/Skeleton'
import { useSocket } from '../../hooks/useSocket'
import api from '../../lib/axios'

function DeploymentDialog({ application, open, onOpenChange, onDone }) {
  const [mode, setMode] = useState('employer')
  const [employerCompanyId, setEmployerCompanyId] = useState('')
  const [officeName, setOfficeName] = useState('')
  const [supervisorName, setSupervisorName] = useState('')
  const [startDate, setStartDate] = useState('')

  const { data: employers } = useQuery({
    queryKey: ['staff', 'employers', 'picker'],
    queryFn: async () => (await api.get('/api/staff/employers', { params: { limit: 100 } })).data.data.items,
    enabled: open && mode === 'employer',
  })

  const assign = useMutation({
    mutationFn: () =>
      api.post(`/api/staff/spes/applications/${application.id}/deployment`, {
        employer_company_id: mode === 'employer' ? employerCompanyId : null,
        office_name: mode === 'office' ? officeName : null,
        supervisor_name: supervisorName,
        start_date: startDate,
      }),
    onSuccess: () => {
      toast.success('Deployment assigned.')
      onOpenChange(false)
      onDone()
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not assign deployment.'),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={`Assign Deployment — ${application?.full_name || ''}`} description="The applicant will be emailed this assignment.">
        <div className="space-y-3">
          <div className="flex rounded-lg border border-border-hover bg-surface p-0.5">
            {[['employer', 'Select Employer'], ['office', 'Internal / Government Office']].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setMode(key)}
                className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium ${mode === key ? 'bg-primary-800 text-white' : 'text-text-secondary hover:bg-surface-hover'}`}
              >
                {label}
              </button>
            ))}
          </div>
          {mode === 'employer' ? (
            <div>
              <Label>Employer</Label>
              <Select value={employerCompanyId} onChange={(e) => setEmployerCompanyId(e.target.value)}>
                <option value="">Select an employer…</option>
                {(employers || []).map((c) => (
                  <option key={c.id} value={c.id}>{c.company_name}</option>
                ))}
              </Select>
            </div>
          ) : (
            <div>
              <Label>Office Name</Label>
              <Input value={officeName} onChange={(e) => setOfficeName(e.target.value)} placeholder="e.g. Municipal Assessor's Office" />
            </div>
          )}
          <div>
            <Label>Supervisor Name</Label>
            <Input value={supervisorName} onChange={(e) => setSupervisorName(e.target.value)} />
          </div>
          <div>
            <Label>Reporting Start Date</Label>
            <DatePicker value={startDate} onChange={setStartDate} />
          </div>
          <div className="flex justify-end">
            <Button
              onClick={() => assign.mutate()}
              disabled={assign.isPending || !supervisorName.trim() || !startDate || (mode === 'employer' ? !employerCompanyId : !officeName.trim())}
            >
              {assign.isPending ? 'Assigning…' : 'Assign Deployment'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function TerminateDialog({ deploymentId, open, onOpenChange, onDone }) {
  const [reason, setReason] = useState('')
  const terminate = useMutation({
    mutationFn: () => api.put(`/api/staff/spes/deployments/${deploymentId}/terminate`, { reason }),
    onSuccess: () => {
      toast.success('Deployment marked terminated.')
      setReason('')
      onOpenChange(false)
      onDone()
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not terminate this deployment.'),
  })
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Terminate Deployment">
        <div className="space-y-3">
          <Textarea placeholder="Reason (required)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="flex justify-end">
            <Button variant="danger" onClick={() => terminate.mutate()} disabled={terminate.isPending || !reason.trim()}>
              {terminate.isPending ? 'Terminating…' : 'Confirm Terminate'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function SPESDeployment() {
  const queryClient = useQueryClient()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const [assigning, setAssigning] = useState(null)
  const [terminating, setTerminating] = useState(null)

  const { data: awaiting, isLoading: awaitingLoading } = useQuery({
    queryKey: ['staff', 'spes', 'applications', { status: 'for_deployment' }],
    queryFn: async () => (await api.get('/api/staff/spes/applications', { params: { status: 'for_deployment' } })).data.data,
  })
  const { data: active, isLoading: activeLoading } = useQuery({
    queryKey: ['staff', 'spes', 'applications', { status: 'deployed' }],
    queryFn: async () => (await api.get('/api/staff/spes/applications', { params: { status: 'deployed' } })).data.data,
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['staff', 'spes'] })
  useSocket({ 'spes:status_change': invalidate })

  const complete = useMutation({
    mutationFn: (deploymentId) => api.put(`/api/staff/spes/deployments/${deploymentId}/complete`),
    onSuccess: () => {
      toast.success('Deployment marked completed.')
      invalidate()
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not complete this deployment.'),
  })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-3 text-sm font-semibold text-text-primary">Awaiting Deployment</h2>
        {awaitingLoading ? (
          <CardSkeleton />
        ) : !awaiting?.length ? (
          <EmptyState title="No applicants awaiting deployment" />
        ) : (
          <div className="space-y-2">
            {awaiting.map((app) => (
              <Card key={app.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-text-primary">{app.full_name}</p>
                    <p className="text-xs text-text-muted">{app.batch_name}</p>
                  </div>
                  <Button size="sm" onClick={() => setAssigning(app)}>Assign Deployment</Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-text-primary">Active Deployments</h2>
        {activeLoading ? (
          <CardSkeleton />
        ) : !active?.length ? (
          <EmptyState title="No active deployments" />
        ) : (
          <div className="space-y-2">
            {active.map((app) => (
              <Card key={app.id}>
                <CardHeader><CardTitle>{app.full_name}</CardTitle></CardHeader>
                <CardContent className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm text-text-secondary">
                    <p>{app.deployment?.employer_name || app.deployment?.office_name} · Supervisor: {app.deployment?.supervisor_name}</p>
                    <p className="text-xs text-text-muted">Reporting {app.deployment?.start_date ? dayjs(app.deployment.start_date).format('MMM D, YYYY') : '—'}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() =>
                        confirm({
                          title: 'Mark Deployment Completed?',
                          description: 'This closes out the applicant\'s SPES cycle.',
                          confirmLabel: 'Mark Completed',
                          onConfirm: () => complete.mutateAsync(app.deployment.id),
                        })
                      }
                    >
                      Mark Completed
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => setTerminating(app.deployment.id)}>Terminate</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {ConfirmDialogElement}
      <DeploymentDialog application={assigning} open={Boolean(assigning)} onOpenChange={(o) => !o && setAssigning(null)} onDone={invalidate} />
      <TerminateDialog deploymentId={terminating} open={Boolean(terminating)} onOpenChange={(o) => !o && setTerminating(null)} onDone={invalidate} />
    </div>
  )
}
