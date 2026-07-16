import { motion } from 'framer-motion'
import { Monitor, Moon, Sun } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'

import { Button } from '../../components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Label } from '../../components/ui/Input'
import { PageHeader } from '../../components/ui/PageHeader'
import { PasswordInput } from '../../components/ui/PasswordInput'
import { PasswordRequirements } from '../../components/ui/PasswordRequirements'
import api from '../../lib/axios'
import { fadeIn } from '../../lib/motion'
import { isStrongPassword } from '../../lib/passwordPolicy'
import { cn } from '../../lib/utils'
import { useAuthStore } from '../../store/authStore'
import { useUiStore } from '../../store/uiStore'

const THEME_OPTIONS = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
]

export function SettingsPage({ showPrivacy = false, showDeactivate = false }) {
  const navigate = useNavigate()
  const logout = useAuthStore((s) => s.logout)
  const theme = useUiStore((s) => s.theme)
  const setTheme = useUiStore((s) => s.setTheme)
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm_password: '' })
  const [saving, setSaving] = useState(false)
  const [confirmDeactivate, setConfirmDeactivate] = useState(false)

  const changePassword = async (e) => {
    e.preventDefault()
    if (!isStrongPassword(pwForm.new_password)) {
      toast.error('New password does not meet all the requirements below.')
      return
    }
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
              <PasswordInput value={pwForm.current_password} onChange={(e) => setPwForm({ ...pwForm, current_password: e.target.value })} required />
            </div>
            <div>
              <Label>New Password</Label>
              <PasswordInput value={pwForm.new_password} onChange={(e) => setPwForm({ ...pwForm, new_password: e.target.value })} required minLength={8} />
              <PasswordRequirements password={pwForm.new_password} />
            </div>
            <div>
              <Label>Confirm New Password</Label>
              <PasswordInput value={pwForm.confirm_password} onChange={(e) => setPwForm({ ...pwForm, confirm_password: e.target.value })} required minLength={8} />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={saving || !isStrongPassword(pwForm.new_password)}>
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
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-text-primary">Theme</p>
              <p className="text-xs text-text-muted">Choose how JobBridge looks. "System" follows your device setting.</p>
            </div>
            <div className="flex rounded-lg border border-border p-0.5">
              {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTheme(value)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium',
                    theme === value ? 'bg-primary-800 text-white' : 'text-text-secondary hover:bg-surface-hover'
                  )}
                >
                  <Icon className="h-3.5 w-3.5" /> {label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-text-primary">Email Notifications</p>
              <p className="text-xs text-text-muted">Receive email alerts for status changes and announcements.</p>
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
            <p className="mb-3 text-sm text-text-muted">Control what employers can see on your profile.</p>
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
        <Card className="border-red-200 dark:border-red-900">
          <CardHeader>
            <CardTitle className="text-red-700 dark:text-red-400">Danger Zone</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-sm text-text-muted">Deactivating your account removes your access. PESO Admin can reactivate it later.</p>
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
