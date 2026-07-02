import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Upload } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import toast from 'react-hot-toast'

import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { Input, Label, Textarea } from '../../components/ui/Input'
import { PageHeader } from '../../components/ui/PageHeader'
import { CardSkeleton } from '../../components/ui/Skeleton'
import api from '../../lib/axios'
import { fadeIn } from '../../lib/motion'

export default function EmployerCompany() {
  const queryClient = useQueryClient()
  const { data: company, isLoading } = useQuery({
    queryKey: ['company'],
    queryFn: async () => (await api.get('/api/company')).data.data,
  })
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (company) setForm(company)
  }, [company])

  const { getRootProps: getLogoProps, getInputProps: getLogoInputProps } = useDropzone({
    accept: { 'image/*': [] },
    maxFiles: 1,
    onDrop: async (accepted) => {
      if (!accepted.length) return
      const fd = new FormData()
      fd.append('file', accepted[0])
      try {
        await api.post('/api/company/logo', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
        toast.success('Logo uploaded.')
        queryClient.invalidateQueries({ queryKey: ['company'] })
      } catch {
        toast.error('Upload failed.')
      }
    },
  })

  const { getRootProps: getDocProps, getInputProps: getDocInputProps } = useDropzone({
    onDrop: async (accepted) => {
      if (!accepted.length) return
      const fd = new FormData()
      fd.append('file', accepted[0])
      try {
        await api.post('/api/company/documents', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
        toast.success('Document uploaded for PESO Staff review.')
        queryClient.invalidateQueries({ queryKey: ['company'] })
      } catch {
        toast.error('Upload failed.')
      }
    },
  })

  const save = async () => {
    setSaving(true)
    try {
      await api.put('/api/company', form)
      toast.success('Company profile updated.')
      queryClient.invalidateQueries({ queryKey: ['company'] })
    } finally {
      setSaving(false)
    }
  }

  if (isLoading || !form) return <CardSkeleton />

  return (
    <motion.div {...fadeIn} className="space-y-6">
      <PageHeader
        title="Company Profile"
        description="Official company listing used by PESO Staff to verify legitimacy."
        actions={
          <Badge variant={form.verification_status === 'verified' ? 'success' : form.verification_status === 'suspended' ? 'danger' : 'default'} className="capitalize">
            {form.verification_status}
          </Badge>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Company Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label>Company Name</Label>
            <Input value={form.company_name || ''} onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
          </div>
          <div>
            <Label>Industry / Sector</Label>
            <Input value={form.industry || ''} onChange={(e) => setForm({ ...form, industry: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <Label>Complete Address</Label>
            <Input value={form.address || ''} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div>
            <Label>Business Permit / DTI-SEC Registration No.</Label>
            <Input value={form.business_permit_no || ''} onChange={(e) => setForm({ ...form, business_permit_no: e.target.value })} />
          </div>
          <div>
            <Label>Website</Label>
            <Input value={form.website || ''} onChange={(e) => setForm({ ...form, website: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <Label>Company Description</Label>
            <Textarea rows={4} value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <Button onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Logo</CardTitle>
          </CardHeader>
          <CardContent>
            {form.logo_url && <img src={form.logo_url} alt="Company logo" className="mb-3 h-16 w-16 rounded-lg object-cover" />}
            <div {...getLogoProps()} className="cursor-pointer rounded-lg border border-dashed border-slate-200 p-4 text-center hover:border-primary-300">
              <input {...getLogoInputProps()} />
              <Upload className="mx-auto mb-1 h-5 w-5 text-slate-400" />
              <p className="text-xs text-slate-500">Upload logo</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Business Registration Documents</CardTitle>
          </CardHeader>
          <CardContent>
            <div {...getDocProps()} className="cursor-pointer rounded-lg border border-dashed border-slate-200 p-4 text-center hover:border-primary-300">
              <input {...getDocInputProps()} />
              <Upload className="mx-auto mb-1 h-5 w-5 text-slate-400" />
              <p className="text-xs text-slate-500">Upload document ({form.document_urls?.length || 0} on file)</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  )
}
