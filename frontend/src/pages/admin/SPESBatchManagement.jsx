import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { Layers, Plus, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'

import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { useConfirmDialog } from '../../components/ui/ConfirmDialog'
import { DatePicker } from '../../components/ui/DatePicker'
import { Dialog, DialogContent } from '../../components/ui/Dialog'
import { EmptyState } from '../../components/ui/EmptyState'
import { Input, Label } from '../../components/ui/Input'
import { CardSkeleton } from '../../components/ui/Skeleton'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { useSocket } from '../../hooks/useSocket'
import api from '../../lib/axios'
import { cn } from '../../lib/utils'

const VIEWS = [
  { key: 'active', label: 'Batch Management', status: 'open' },
  { key: 'archived', label: 'Archived Batches', status: 'archived' },
  { key: 'closed', label: 'Closed Batches', status: 'closed' },
]

const EMPTY_FORM = {
  batch_name: '', description: '', open_date: '', registration_deadline: '', total_slots: '',
  budget_allocation: '', min_gwa: '', max_family_income: '', requirements: [],
}

function BatchFormDialog({ open, onOpenChange, batch, onSaved }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [requirementInput, setRequirementInput] = useState('')

  const isEdit = Boolean(batch)

  const initialize = () => {
    setForm(
      batch
        ? {
            batch_name: batch.batch_name, description: batch.description || '',
            open_date: batch.open_date, registration_deadline: batch.registration_deadline,
            total_slots: batch.total_slots, budget_allocation: batch.budget_allocation ?? '',
            min_gwa: batch.min_gwa ?? '', max_family_income: batch.max_family_income ?? '',
            requirements: batch.requirements || [],
          }
        : EMPTY_FORM
    )
  }

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        batch_name: form.batch_name, description: form.description,
        open_date: form.open_date, registration_deadline: form.registration_deadline,
        total_slots: Number(form.total_slots),
        budget_allocation: form.budget_allocation === '' ? null : Number(form.budget_allocation),
        min_gwa: form.min_gwa === '' ? null : Number(form.min_gwa),
        max_family_income: form.max_family_income === '' ? null : Number(form.max_family_income),
        requirements: form.requirements,
      }
      return isEdit ? api.put(`/api/admin/spes/batches/${batch.id}`, payload) : api.post('/api/admin/spes/batches', payload)
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Batch updated.' : 'Batch created.')
      onOpenChange(false)
      onSaved()
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not save this batch.'),
  })

  const addRequirement = () => {
    const value = requirementInput.trim()
    if (!value) return
    setForm((f) => ({ ...f, requirements: [...f.requirements, value] }))
    setRequirementInput('')
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (o) initialize(); onOpenChange(o) }}>
      <DialogContent title={isEdit ? 'Edit Batch' : 'Create New SPES Batch'} className="max-w-lg">
        <div className="space-y-3">
          <div>
            <Label>Batch Name</Label>
            <Input value={form.batch_name} onChange={(e) => setForm({ ...form, batch_name: e.target.value })} placeholder="e.g. SPES 2026 — Summer Batch" />
          </div>
          <div>
            <Label>Description</Label>
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label>Open Date</Label>
              <DatePicker value={form.open_date} onChange={(v) => setForm({ ...form, open_date: v })} />
            </div>
            <div>
              <Label>Registration Deadline</Label>
              <DatePicker value={form.registration_deadline} onChange={(v) => setForm({ ...form, registration_deadline: v })} minDate={form.open_date} />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label>Total Slots</Label>
              <Input type="number" min={1} value={form.total_slots} onChange={(e) => setForm({ ...form, total_slots: e.target.value })} />
            </div>
            <div>
              <Label>Budget Allocation (optional)</Label>
              <Input type="number" step="0.01" value={form.budget_allocation} onChange={(e) => setForm({ ...form, budget_allocation: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label>Passing GWA Threshold (optional)</Label>
              <Input type="number" step="0.01" value={form.min_gwa} onChange={(e) => setForm({ ...form, min_gwa: e.target.value })} placeholder="No requirement" />
              <p className="mt-1 text-xs text-text-muted">1.00 = highest; e.g. 2.00 means a GWA of 1.00–2.00 qualifies.</p>
            </div>
            <div>
              <Label>Max Family Income (optional)</Label>
              <Input type="number" step="0.01" value={form.max_family_income} onChange={(e) => setForm({ ...form, max_family_income: e.target.value })} placeholder="No cap" />
            </div>
          </div>
          <div>
            <Label>Requirements Checklist</Label>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {form.requirements.map((r, i) => (
                <Badge key={i} variant="default" className="flex items-center gap-1">
                  {r}
                  <button type="button" onClick={() => setForm((f) => ({ ...f, requirements: f.requirements.filter((_, idx) => idx !== i) }))}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={requirementInput}
                onChange={(e) => setRequirementInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addRequirement() } }}
                placeholder="e.g. Photocopy of PSA Birth Certificate"
              />
              <Button type="button" size="sm" variant="secondary" onClick={addRequirement}>Add</Button>
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              onClick={() => save.mutate()}
              disabled={save.isPending || !form.batch_name.trim() || !form.open_date || !form.registration_deadline || !form.total_slots}
            >
              {save.isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Batch'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function SPESBatchManagement() {
  const queryClient = useQueryClient()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const [formOpen, setFormOpen] = useState(false)
  const [editingBatch, setEditingBatch] = useState(null)
  const [view, setView] = useState('active')

  const { data: batches, isLoading } = useQuery({
    queryKey: ['admin', 'spes', 'batches'],
    queryFn: async () => (await api.get('/api/staff/spes/batches')).data.data,
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin', 'spes', 'batches'] })
  useSocket({ 'spes:batch_update': invalidate })

  const activeStatus = VIEWS.find((v) => v.key === view).status
  const visibleBatches = useMemo(() => (batches || []).filter((b) => b.status === activeStatus), [batches, activeStatus])

  const close = useMutation({
    mutationFn: (id) => api.put(`/api/admin/spes/batches/${id}/close`),
    onSuccess: () => { toast.success('Batch closed.'); invalidate() },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not close this batch.'),
  })
  const archive = useMutation({
    mutationFn: (id) => api.put(`/api/admin/spes/batches/${id}/archive`),
    onSuccess: () => { toast.success('Batch archived.'); invalidate() },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not archive this batch.'),
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex rounded-lg border border-border bg-surface p-0.5">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => setView(v.key)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium sm:text-sm',
                view === v.key ? 'bg-primary-800 text-white' : 'text-text-secondary hover:bg-surface-hover',
              )}
            >
              {v.label}
            </button>
          ))}
        </div>
        {view === 'active' && (
          <Button size="sm" onClick={() => { setEditingBatch(null); setFormOpen(true) }}>
            <Plus className="h-4 w-4" /> Create New Batch
          </Button>
        )}
      </div>

      {isLoading ? (
        <CardSkeleton />
      ) : !visibleBatches.length ? (
        <EmptyState
          icon={Layers}
          title={view === 'active' ? 'No active SPES batches' : `No ${view} batches`}
          description={view === 'active' ? 'Create a batch to open SPES registration to jobseekers.' : undefined}
        />
      ) : (
        <div className="space-y-2">
          {visibleBatches.map((batch) => (
            <Card key={batch.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {batch.batch_name}
                  <StatusBadge status={batch.status} />
                  {batch.is_full && <Badge variant="danger">Full</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm text-text-secondary">
                  <p>{batch.current_applicants}/{batch.total_slots} slots filled · Deadline {dayjs(batch.registration_deadline).format('MMM D, YYYY')}</p>
                  {batch.budget_allocation != null && <p className="text-xs text-text-muted">Budget: ₱{batch.budget_allocation.toLocaleString()}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  {batch.status === 'open' && (
                    <>
                      <Button size="sm" variant="secondary" onClick={() => { setEditingBatch(batch); setFormOpen(true) }}>Edit</Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => confirm({
                          title: 'Close this batch?',
                          description: 'Closing stops new registrations. Existing applicants continue through the pipeline unaffected.',
                          confirmLabel: 'Close Batch',
                          onConfirm: () => close.mutateAsync(batch.id),
                        })}
                      >
                        Close
                      </Button>
                    </>
                  )}
                  {batch.status !== 'archived' && (
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => confirm({
                        title: 'Archive this batch?',
                        description: 'Archived batches are hidden from active lists but remain in reports.',
                        confirmLabel: 'Archive Batch',
                        onConfirm: () => archive.mutateAsync(batch.id),
                      })}
                    >
                      Archive
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {ConfirmDialogElement}
      <BatchFormDialog open={formOpen} onOpenChange={setFormOpen} batch={editingBatch} onSaved={invalidate} />
    </div>
  )
}
