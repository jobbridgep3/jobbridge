import { motion } from 'framer-motion'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'

import { Button } from '../../components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Input, Label } from '../../components/ui/Input'
import { PageHeader } from '../../components/ui/PageHeader'
import api from '../../lib/axios'
import { fadeIn } from '../../lib/motion'
import { useAuthStore } from '../../store/authStore'

export function SettingsPage({ showPrivacy = false, showDeactivate = false }) {
  const navigate = useNavigate()
  const logout = useAuthStore((s) => s.logout)
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm_password: '' })
  const [saving, setSaving] = useState(false)
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('jobbridge-theme') === 'dark')
  const [confirmDeactivate, setConfirmDeactivate] = useState(false)

  const changePassword = async (e) => {
    e.preventDefault()
    if (pwForm.new_password !== pwForm.confirm_password) {
      toast.error('New passwords do not match.')
      return
    }
    setSaving(true)
    try {
      await api.put('/api/auth/change-password', {
        current_password: pwForm.current_password,
        new_password: pwForm.new_password,
      })
      toast.success('Password changed.')
      setPwForm({ current_password: '', new_password: '', confirm_password: '' })
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not change password.')
    } finally {
      setSaving(false)
    }
  }

  const toggleDarkMode = () => {
    const next = !darkMode
    setDarkMode(next)
    localStorage.setItem('jobbridge-theme', next ? 'dark' : 'light')
    document.documentElement.classList.toggle('dark', next)
  }

  const deactivateAccount = async () => {
    try {
      await api.delete('/api/account')
      toast.success('Account deactivated.')
      logout()
      navigate('/login')
    } catch {
      toast.error('Could not deactivate account.')
    }
  }

  return (
    <motion.div {...fadeIn} className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Settings" description="Account settings and preferences." />

      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={changePassword} className="space-y-4">
            <div>
              <Label>Current Password</Label>
              <Input type="password" value={pwForm.current_password} onChange={(e) => setPwForm({ ...pwForm, current_password: e.target.value })} required />
            </div>
            <div>
              <Label>New Password</Label>
              <Input type="password" value={pwForm.new_password} onChange={(e) => setPwForm({ ...pwForm, new_password: e.target.value })} required minLength={8} />
            </div>
            <div>
              <Label>Confirm New Password</Label>
              <Input type="password" value={pwForm.confirm_password} onChange={(e) => setPwForm({ ...pwForm, confirm_password: e.target.value })} required minLength={8} />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Update Password'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preferences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-800">Dark Mode</p>
              <p className="text-xs text-slate-500">Toggle the interface theme.</p>
            </div>
            <button
              onClick={toggleDarkMode}
              className={`h-6 w-11 rounded-full transition-colors ${darkMode ? 'bg-primary-700' : 'bg-slate-200'}`}
            >
              <span className={`block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow transition-transform ${darkMode ? 'translate-x-5' : ''}`} />
            </button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-800">Email Notifications</p>
              <p className="text-xs text-slate-500">Receive email alerts for status changes and announcements.</p>
            </div>
            <button
              onClick={async () => {
                await api.put('/api/settings/notifications', { enabled: true })
                toast.success('Preference saved.')
              }}
              className="h-6 w-11 rounded-full bg-primary-700"
            >
              <span className="block h-5 w-5 translate-x-5 rounded-full bg-white shadow" />
            </button>
          </div>
        </CardContent>
      </Card>

      {showPrivacy && (
        <Card>
          <CardHeader>
            <CardTitle>Privacy</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-sm text-slate-500">Control what employers can see on your profile.</p>
            <Button
              variant="secondary"
              size="sm"
              onClick={async () => {
                await api.put('/api/settings/privacy', {})
                toast.success('Privacy settings saved.')
              }}
            >
              Save Privacy Settings
            </Button>
          </CardContent>
        </Card>
      )}

      {showDeactivate && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-red-700">Danger Zone</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-sm text-slate-500">Deactivating your account removes your access. PESO Admin can reactivate it later.</p>
            <Button variant="danger" size="sm" onClick={() => setConfirmDeactivate(true)}>
              Deactivate Account
            </Button>
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={confirmDeactivate}
        onOpenChange={setConfirmDeactivate}
        title="Deactivate your account?"
        description="You will be logged out immediately. Contact PESO staff to reactivate."
        confirmLabel="Deactivate"
        danger
        onConfirm={deactivateAccount}
      />
    </motion.div>
  )
}
