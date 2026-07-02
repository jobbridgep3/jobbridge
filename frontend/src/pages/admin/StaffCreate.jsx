import { motion } from 'framer-motion'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'

import { Button } from '../../components/ui/Button'
import { Card, CardContent } from '../../components/ui/Card'
import { Input, Label } from '../../components/ui/Input'
import { PageHeader } from '../../components/ui/PageHeader'
import api from '../../lib/axios'
import { fadeIn } from '../../lib/motion'

export default function AdminStaffCreate() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ full_name: '', email: '' })
  const [saving, setSaving] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.post('/api/admin/staff', form)
      toast.success('Staff account created — credentials emailed.')
      navigate('/admin/staff')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not create staff account.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <motion.div {...fadeIn} className="mx-auto max-w-lg">
      <PageHeader title="Create Staff Account" description="A temporary password will be generated and emailed automatically." />
      <Card>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label>Full Name</Label>
              <Input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div>
              <Label>Official Email Address</Label>
              <Input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => navigate('/admin/staff')}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Creating…' : 'Create Account'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  )
}
