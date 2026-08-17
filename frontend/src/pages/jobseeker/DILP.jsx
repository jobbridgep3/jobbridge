import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { HandCoins, Upload } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'

import { DilpNoShowBanner, DilpStepper } from '../../components/dilp/DilpStepper'
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
import { manila } from '../../lib/manilaTime'
import { fadeIn } from '../../lib/motion'

const STATUS_MESSAGES = {
  pending: 'Your application is under review. You will be notified once an interview is scheduled.',
  completed: "Your interview has been completed. Please proceed to the PESO Office for the finalization and Mayor's signature of your proposal.",
  no_show: 'You were marked absent for your scheduled interview. Please contact the PESO Office to reschedule.',
  ready_for_claiming: 'Your proposal has been signed and is ready for claiming at the PESO Office.',
  approved: 'Your DILP proposal has been officially approved.',
  submitted_to_esfo: 'Your application has been submitted to ESFO for funding. This concludes tracking within the system — please coordinate with PESO for funding updates.',
}

function scheduledMessage(app) {
  if (!app.interview_at) return null
  const m = manila(app.interview_at)
  return `Your interview is scheduled on ${m.format('MMMM D, YYYY')} at ${m.format('h:mm A')} at the PESO Office, Municipality of Pila.`
}

function DocumentSlot({ application, onChanged }) {
  const [uploading, setUploading] = useState(false)

  const upload = async (file) => {
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    try {
      await api.post(`/api/dilp/${application.id}/documents`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      toast.success('Document uploaded.')
      onChanged()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed.')
    } finally {
      setUploading(false)
    }
  }

  const remove = async (documentId) => {
    try {
      await api.delete(`/api/dilp/documents/${documentId}`)
      toast.success('Document removed.')
      onChanged()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not remove document.')
    }
  }

  if (application.status !== 'pending' && !application.documents?.length) return null

  return (
    <div className="mt-3">
      <DocumentUploadSlot
        label="Supporting Document (optional — e.g. a printed proposal)"
        required={false}
        multiple={false}
        documents={application.documents || []}
        uploading={uploading}
        onUpload={application.status === 'pending' ? upload : undefined}
        onDelete={application.status === 'pending' ? remove : undefined}
      />
    </div>
  )
}

export default function JobseekerDILP() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ proposed_livelihood: '', business_description: '', capital_needed: '' })

  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => (await api.get('/api/profile')).data.data,
  })

  const { data: applications, isLoading } = useQuery({
    queryKey: ['dilp', 'my'],
    queryFn: async () => (await api.get('/api/dilp/my')).data.data,
  })

  useSocket({ 'dilp:status_change': () => queryClient.invalidateQueries({ queryKey: ['dilp', 'my'] }) })

  const applyMutation = useMutation({
    mutationFn: () => api.post('/api/dilp/apply', form),
    onSuccess: ({ data }) => {
      toast.success('Your DILP application has been submitted. You will be notified once your interview is scheduled.')
      if (data?.data?.has_other_active_application) {
        toast('Note: you already have another DILP application in progress. Only one active application at a time is recommended.', { icon: '⚠️' })
      }
      queryClient.invalidateQueries({ queryKey: ['dilp', 'my'] })
      setForm({ proposed_livelihood: '', business_description: '', capital_needed: '' })
      setShowForm(false)
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not submit application.'),
  })

  const canSubmit = form.proposed_livelihood.trim() && form.business_description.trim() && Number(form.capital_needed) > 0

  return (
    <motion.div {...fadeIn} className="space-y-6">
      <PageHeader
        title="DOLE Integrated Livelihood Program (DILP)"
        description="Assistance program for disadvantaged/marginalized residents of Pila to start a livelihood."
      />

      {!showForm && (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <HandCoins className="h-8 w-8 text-primary-600" />
              <div>
                <p className="text-sm font-medium text-text-primary">Have a livelihood idea?</p>
                <p className="text-xs text-text-muted">Submit a DILP application and PESO staff will guide you through the rest.</p>
              </div>
            </div>
            <Button onClick={() => setShowForm(true)}>Apply for DILP</Button>
          </CardContent>
        </Card>
      )}

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>New DILP Application</CardTitle>
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
              <Label>Address</Label>
              <Input value={profile?.address || ''} disabled />
            </div>
            <div className="sm:col-span-2">
              <Label>Email</Label>
              <Input value={profile?.email || ''} disabled />
            </div>
            <div className="sm:col-span-2">
              <Label>Proposed Livelihood / Business Name</Label>
              <Input
                value={form.proposed_livelihood}
                onChange={(e) => setForm({ ...form, proposed_livelihood: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Business Description / Justification</Label>
              <Textarea
                value={form.business_description}
                onChange={(e) => setForm({ ...form, business_description: e.target.value })}
              />
            </div>
            <div>
              <Label>Capital Needed (₱)</Label>
              <Input
                type="number"
                min="0"
                value={form.capital_needed}
                onChange={(e) => setForm({ ...form, capital_needed: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button onClick={() => applyMutation.mutate()} disabled={applyMutation.isPending || !canSubmit}>
                {applyMutation.isPending ? 'Submitting…' : 'Submit Application'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>My DILP Applications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <CardSkeleton />
          ) : !applications?.length ? (
            <EmptyState icon={Upload} title="No applications yet" description="Submit a DILP application above to get started." />
          ) : (
            applications.map((app) => (
              <div key={app.id} className="rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-text-primary">{app.proposed_livelihood}</p>
                    <p className="text-xs text-text-muted">Submitted {manila(app.created_at).format('MMM D, YYYY')}</p>
                  </div>
                  <StatusBadge status={app.status} />
                </div>

                <DilpStepper status={app.status} history={app.history} />

                {app.status === 'no_show' && <DilpNoShowBanner>{STATUS_MESSAGES.no_show}</DilpNoShowBanner>}

                <p className="mt-3 text-sm text-text-secondary">
                  {app.status === 'scheduled' ? scheduledMessage(app) : STATUS_MESSAGES[app.status]}
                </p>

                <div className="mt-3 grid grid-cols-1 gap-2 rounded-md bg-surface-secondary/60 p-3 text-sm sm:grid-cols-2">
                  <div><span className="text-text-muted">Capital Needed:</span> ₱{Number(app.capital_needed).toLocaleString()}</div>
                  <div className="sm:col-span-2"><span className="text-text-muted">Description:</span> {app.business_description}</div>
                </div>

                {app.remarks?.length > 0 && (
                  <div className="mt-3 rounded-md bg-primary-50 px-3 py-2 text-sm text-primary-900 dark:bg-primary-900/30 dark:text-primary-200">
                    <p className="font-medium">Staff Remarks</p>
                    {app.remarks.map((r) => <p key={r.id} className="mt-1">{r.remark}</p>)}
                  </div>
                )}

                <DocumentSlot application={app} onChanged={() => queryClient.invalidateQueries({ queryKey: ['dilp', 'my'] })} />
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
