import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'

import { Button } from '../../components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { Input, Label } from '../../components/ui/Input'
import { PageHeader } from '../../components/ui/PageHeader'
import { CardSkeleton } from '../../components/ui/Skeleton'
import api from '../../lib/axios'
import { fadeIn } from '../../lib/motion'
import { SettingsPage } from '../shared/SettingsPage'

export default function AdminSettings() {
  const queryClient = useQueryClient()
  const { data: settings, isLoading } = useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: async () => (await api.get('/api/admin/settings')).data.data,
  })
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (settings) setForm(settings)
  }, [settings])

  const save = async () => {
    setSaving(true)
    try {
      await api.put('/api/admin/settings', form)
      toast.success('System settings updated.')
      queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] })
    } finally {
      setSaving(false)
    }
  }

  return (
    <motion.div {...fadeIn} className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="System Settings" description="System-level configuration — accessible only to Admin." />

      {isLoading || !form ? (
        <CardSkeleton />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Session & Rate Limits</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label>Admin Session Timeout (min)</Label>
              <Input value={form.session_timeout_admin_minutes} onChange={(e) => setForm({ ...form, session_timeout_admin_minutes: e.target.value })} />
            </div>
            <div>
              <Label>Staff Session Timeout (min)</Label>
              <Input value={form.session_timeout_staff_minutes} onChange={(e) => setForm({ ...form, session_timeout_staff_minutes: e.target.value })} />
            </div>
            <div>
              <Label>Default Session Timeout (min)</Label>
              <Input value={form.session_timeout_default_minutes} onChange={(e) => setForm({ ...form, session_timeout_default_minutes: e.target.value })} />
            </div>
            <div>
              <Label>Login Attempts per 15 min</Label>
              <Input value={form.rate_limit_login_per_15min} onChange={(e) => setForm({ ...form, rate_limit_login_per_15min: e.target.value })} />
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <Button onClick={save} disabled={saving}>
                {saving ? 'Saving…' : 'Save System Settings'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <SettingsPage />
    </motion.div>
  )
}
