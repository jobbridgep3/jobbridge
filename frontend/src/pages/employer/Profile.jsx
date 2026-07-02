import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Link } from 'react-router-dom'

import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { Input, Label } from '../../components/ui/Input'
import { PageHeader } from '../../components/ui/PageHeader'
import { CardSkeleton } from '../../components/ui/Skeleton'
import api from '../../lib/axios'
import { fadeIn } from '../../lib/motion'

export default function EmployerProfile() {
  const queryClient = useQueryClient()
  const { data: profile, isLoading } = useQuery({
    queryKey: ['employer', 'profile'],
    queryFn: async () => (await api.get('/api/employer/profile')).data.data,
  })
  const { data: company } = useQuery({
    queryKey: ['company'],
    queryFn: async () => (await api.get('/api/company')).data.data,
  })
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (profile) setForm(profile)
  }, [profile])

  const save = async () => {
    setSaving(true)
    try {
      await api.put('/api/employer/profile', form)
      toast.success('Profile updated.')
      queryClient.invalidateQueries({ queryKey: ['employer', 'profile'] })
    } finally {
      setSaving(false)
    }
  }

  if (isLoading || !form) return <CardSkeleton />

  return (
    <motion.div {...fadeIn} className="mx-auto max-w-2xl space-y-4">
      <PageHeader title="My Profile" description="HR contact person account settings." />
      <Card>
        <CardHeader>
          <CardTitle>Contact Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>HR Contact Name</Label>
            <Input value={form.hr_contact_name || ''} onChange={(e) => setForm({ ...form, hr_contact_name: e.target.value })} />
          </div>
          <div>
            <Label>Contact Number</Label>
            <Input value={form.contact_number || ''} onChange={(e) => setForm({ ...form, contact_number: e.target.value })} />
          </div>
          <div>
            <Label>Email</Label>
            <Input value={form.email || ''} disabled />
          </div>
          <div className="flex justify-end">
            <Button onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-800">{company?.company_name || 'Company Profile'}</p>
            <Badge variant={company?.verification_status === 'verified' ? 'success' : 'default'} className="mt-1 capitalize">
              {company?.verification_status}
            </Badge>
          </div>
          <Button variant="secondary" size="sm" asChild>
            <Link to="/employer/company">Manage Company Profile</Link>
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  )
}
