import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { motion } from 'framer-motion'
import { FileText, Upload } from 'lucide-react'
import { useState } from 'react'
import { useDropzone } from 'react-dropzone'
import toast from 'react-hot-toast'

import { Button } from '../../components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Input, Label, Textarea } from '../../components/ui/Input'
import { PageHeader } from '../../components/ui/PageHeader'
import { CardSkeleton } from '../../components/ui/Skeleton'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { useSocket } from '../../hooks/useSocket'
import api from '../../lib/axios'
import { fadeIn } from '../../lib/motion'

/**
 * SPES / DILP / OWWA share an identical apply + track workflow on the backend
 * (ProgramApplication model). This one component drives all three jobseeker pages,
 * configured by `programType` and its form field list.
 */
export function ProgramApplicationPage({ programType, title, description, formFields }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState(Object.fromEntries(formFields.map((f) => [f.name, ''])))

  const { data: applications, isLoading } = useQuery({
    queryKey: [programType, 'my'],
    queryFn: async () => (await api.get(`/api/${programType}/my`)).data.data,
  })

  useSocket({ 'program:status_change': (p) => p.type === programType && queryClient.invalidateQueries({ queryKey: [programType, 'my'] }) })

  const applyMutation = useMutation({
    mutationFn: () => api.post(`/api/${programType}/apply`, { form_data: form }),
    onSuccess: () => {
      toast.success('Application submitted.')
      queryClient.invalidateQueries({ queryKey: [programType, 'my'] })
      setForm(Object.fromEntries(formFields.map((f) => [f.name, ''])))
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not submit application.'),
  })

  return (
    <motion.div {...fadeIn} className="space-y-6">
      <PageHeader title={title} description={description} />

      <Card>
        <CardHeader>
          <CardTitle>New Application</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {formFields.map((field) => (
            <div key={field.name} className={field.wide ? 'sm:col-span-2' : ''}>
              <Label>{field.label}</Label>
              {field.type === 'textarea' ? (
                <Textarea value={form[field.name]} onChange={(e) => setForm({ ...form, [field.name]: e.target.value })} />
              ) : (
                <Input type={field.type || 'text'} value={form[field.name]} onChange={(e) => setForm({ ...form, [field.name]: e.target.value })} />
              )}
            </div>
          ))}
          <div className="sm:col-span-2 flex justify-end">
            <Button onClick={() => applyMutation.mutate()} disabled={applyMutation.isPending}>
              {applyMutation.isPending ? 'Submitting…' : 'Submit Application'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>My Applications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <CardSkeleton />
          ) : !applications?.length ? (
            <EmptyState icon={FileText} title="No applications yet" />
          ) : (
            applications.map((app) => (
              <div key={app.id} className="rounded-lg border border-slate-100 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-400">Submitted {dayjs(app.created_at).format('MMM D, YYYY')}</p>
                  <StatusBadge status={app.status} />
                </div>
                {app.remarks && <p className="mt-2 text-sm text-slate-600">Staff remarks: {app.remarks}</p>}
                <DocUploadZone
                  programType={programType}
                  applicationId={app.id}
                  uploadedCount={app.document_urls?.length || 0}
                  onUploaded={() => queryClient.invalidateQueries({ queryKey: [programType, 'my'] })}
                />
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}

function DocUploadZone({ programType, applicationId, uploadedCount, onUploaded }) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    maxFiles: 1,
    onDrop: async (accepted) => {
      if (!accepted.length) return
      const fd = new FormData()
      fd.append('file', accepted[0])
      fd.append('application_id', applicationId)
      try {
        await api.post(`/api/${programType}/upload-docs`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
        toast.success('Document uploaded.')
        onUploaded()
      } catch {
        toast.error('Upload failed.')
      }
    },
  })

  return (
    <div
      {...getRootProps()}
      className={`mt-3 cursor-pointer rounded-lg border border-dashed p-3 text-center transition-colors ${
        isDragActive ? 'border-primary-400 bg-primary-50' : 'border-slate-200 hover:border-primary-300'
      }`}
    >
      <input {...getInputProps()} />
      <p className="flex items-center justify-center gap-1.5 text-xs text-slate-500">
        <Upload className="h-3.5 w-3.5" /> Upload supporting document ({uploadedCount} uploaded)
      </p>
    </div>
  )
}
