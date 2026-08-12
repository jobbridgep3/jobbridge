import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { motion } from 'framer-motion'
import { Check, HandHeart, Upload } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'

import { Button } from '../../components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { DocumentUploadSlot } from '../../components/ui/DocumentUploadSlot'
import { EmptyState } from '../../components/ui/EmptyState'
import { Input, Label, Textarea } from '../../components/ui/Input'
import { PageHeader } from '../../components/ui/PageHeader'
import { CardSkeleton } from '../../components/ui/Skeleton'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { useSocket } from '../../hooks/useSocket'
import api from '../../lib/axios'
import { fadeIn } from '../../lib/motion'
import { cn } from '../../lib/utils'

const REQUIREMENTS = [
  'Application form — generated automatically for you once you submit, no upload needed',
  'Proof of OFW status or beneficiary relationship (e.g. OWWA membership, OEC, or a valid ID)',
  'Other supporting documents as applicable',
]

const STEPS = [
  { key: 'pending', label: 'Pending', dateField: 'submitted_at' },
  { key: 'verified', label: 'Verified', dateField: 'verified_at' },
  { key: 'submitted_to_owwa', label: 'Submitted to OWWA', dateField: 'submitted_to_owwa_at' },
  { key: 'for_owwa_response', label: 'Awaiting Response', dateField: 'for_owwa_response_at' },
  { key: 'completed', label: 'Completed', dateField: 'completed_at' },
]

function OwwaStepper({ request }) {
  if (request.status === 'declined') return null
  const currentIndex = Math.max(0, STEPS.findIndex((s) => s.key === request.status))
  return (
    <ol className="mt-3 flex items-center gap-1.5">
      {STEPS.map((step, i) => (
        <li key={step.key} className="flex flex-1 items-center gap-1.5">
          <div className="flex flex-col items-center gap-1">
            <span
              className={cn(
                'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold',
                i <= currentIndex ? 'bg-primary-800 text-white' : 'bg-surface-hover text-text-muted'
              )}
            >
              {i < currentIndex ? <Check className="h-3 w-3" /> : i + 1}
            </span>
            <span className={cn('hidden text-center text-[10px] sm:block', i <= currentIndex ? 'text-text-primary' : 'text-text-muted')}>
              {step.label}
              {request[step.dateField] && <span className="block text-text-muted">{dayjs(request[step.dateField]).format('MMM D')}</span>}
            </span>
          </div>
          {i < STEPS.length - 1 && <div className={cn('h-0.5 flex-1', i < currentIndex ? 'bg-primary-800' : 'bg-surface-hover')} />}
        </li>
      ))}
    </ol>
  )
}

function RequestDocuments({ request, onChanged }) {
  const applicationForms = (request.documents || []).filter((d) => d.document_type === 'application_form')
  const supportingDocs = (request.documents || []).filter((d) => d.document_type === 'supporting_document')
  const [uploadingType, setUploadingType] = useState(null)

  const upload = async (documentType, file) => {
    setUploadingType(documentType)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('document_type', documentType)
    try {
      await api.post(`/api/owwa/${request.id}/documents`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      toast.success('Document uploaded.')
      onChanged()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed.')
    } finally {
      setUploadingType(null)
    }
  }

  const remove = async (documentId) => {
    try {
      await api.delete(`/api/owwa/documents/${documentId}`)
      toast.success('Document removed.')
      onChanged()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not remove document.')
    }
  }

  if (request.status !== 'pending' && !request.documents?.length) return null

  return (
    <div className="mt-3 space-y-3">
      <DocumentUploadSlot
        label="Application Form (auto-generated)"
        required
        multiple={false}
        documents={applicationForms}
      />
      <DocumentUploadSlot
        label="Supporting Documents"
        required
        multiple
        documents={supportingDocs}
        uploading={uploadingType === 'supporting_document'}
        onUpload={request.status === 'pending' ? (file) => upload('supporting_document', file) : undefined}
        onDelete={request.status === 'pending' ? remove : undefined}
      />
    </div>
  )
}

export default function JobseekerOWWA() {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({ ofw_relationship: '', notes: '' })

  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => (await api.get('/api/profile')).data.data,
  })

  const { data: requests, isLoading } = useQuery({
    queryKey: ['owwa', 'my'],
    queryFn: async () => (await api.get('/api/owwa/my')).data.data,
  })

  useSocket({ 'owwa:status_change': () => queryClient.invalidateQueries({ queryKey: ['owwa', 'my'] }) })

  const applyMutation = useMutation({
    mutationFn: () => api.post('/api/owwa/apply', form),
    onSuccess: () => {
      toast.success('OWWA Assistance request submitted.')
      queryClient.invalidateQueries({ queryKey: ['owwa', 'my'] })
      setForm({ ofw_relationship: '', notes: '' })
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not submit request.'),
  })

  return (
    <motion.div {...fadeIn} className="space-y-6">
      <PageHeader
        title="OWWA Assistance Program"
        description="Provides social and welfare assistance to overseas workers (OFWs) and their beneficiaries. PESO Pila verifies your eligibility and coordinates with OWWA Region IV-A on your behalf."
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><HandHeart className="h-4 w-4 text-primary-600" /> Who May Avail & Requirements</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-text-secondary">OFWs and their immediate beneficiaries.</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-text-secondary">
            {REQUIREMENTS.map((r) => <li key={r}>{r}</li>)}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>New Assistance Request</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label>Full Name</Label>
            <Input value={profile?.full_name || ''} disabled />
          </div>
          <div>
            <Label>Contact Number</Label>
            <Input value={profile?.contact_number || ''} disabled />
          </div>
          <div className="sm:col-span-2">
            <Label>Email</Label>
            <Input value={profile?.email || ''} disabled />
          </div>
          <div className="sm:col-span-2">
            <Label>OFW Status / Relationship to OFW</Label>
            <Input
              placeholder="e.g. Self (OFW) or Spouse of OFW Juan Dela Cruz"
              value={form.ofw_relationship}
              onChange={(e) => setForm({ ...form, ofw_relationship: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Supporting Details (optional)</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <Button
              onClick={() => applyMutation.mutate()}
              disabled={applyMutation.isPending || !form.ofw_relationship.trim()}
            >
              {applyMutation.isPending ? 'Submitting…' : 'Submit Request'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>My Requests</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <CardSkeleton />
          ) : !requests?.length ? (
            <EmptyState icon={Upload} title="No requests yet" description="Submit a request above to get started." />
          ) : (
            requests.map((r) => (
              <div key={r.id} className="rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-text-primary">{r.ofw_relationship}</p>
                    <p className="text-xs text-text-muted">Submitted {dayjs(r.submitted_at || r.created_at).format('MMM D, YYYY')}</p>
                  </div>
                  <StatusBadge status={r.status} />
                </div>

                {r.status === 'declined' && r.declined_reason && (
                  <p className="mt-2 text-sm text-red-600">Reason: {r.declined_reason}</p>
                )}
                {r.status === 'completed' && (
                  <div className="mt-2 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
                    <p className="font-medium">Your assistance has been processed by OWWA.</p>
                    {r.appointment_at ? (
                      <p className="mt-1">
                        Please proceed to the <b>PESO Pila Office</b> on <b>{dayjs(r.appointment_at).format('MMMM D, YYYY')}</b> at{' '}
                        <b>{dayjs(r.appointment_at).format('h:mm A')}</b> to coordinate the next steps.
                      </p>
                    ) : (
                      <p className="mt-1">Please proceed to the PESO Pila office for next steps.</p>
                    )}
                  </div>
                )}
                {['submitted_to_owwa', 'for_owwa_response'].includes(r.status) && (
                  <p className="mt-2 text-xs text-text-muted">Your application is now with OWWA Region IV-A. PESO Pila is coordinating on your behalf.</p>
                )}

                <OwwaStepper request={r} />
                <RequestDocuments request={r} onChanged={() => queryClient.invalidateQueries({ queryKey: ['owwa', 'my'] })} />
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
