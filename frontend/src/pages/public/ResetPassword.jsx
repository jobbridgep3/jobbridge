import { useState } from 'react'
import toast from 'react-hot-toast'
import { useLocation, useNavigate } from 'react-router-dom'

import { Button } from '../../components/ui/Button'
import { Input, Label } from '../../components/ui/Input'
import { formatCountdown, useCountdown } from '../../hooks/useCountdown'
import api from '../../lib/axios'
import { AuthLayout } from './AuthLayout'

export default function ResetPassword() {
  const location = useLocation()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    email: location.state?.email || '',
    code: location.state?.code || '',
    new_password: '',
    confirm_password: '',
  })
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  // otpDeadline carries the SAME absolute deadline from when the code was requested on
  // the forgot-password step — it's not restarted here, so the displayed time stays
  // accurate to the code's real server-side expiry across the verify-otp -> reset-password
  // navigation.
  const otpDeadline = location.state?.otpDeadline || null
  const secondsLeft = useCountdown(otpDeadline)
  const expired = otpDeadline != null && secondsLeft <= 0

  const onSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    if (form.new_password !== form.confirm_password) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    try {
      await api.post('/api/auth/reset-password', {
        email: form.email,
        code: form.code,
        new_password: form.new_password,
      })
      toast.success('Password reset. You may now log in.')
      navigate('/login')
    } catch (err) {
      setError(err.response?.data?.message || 'Reset failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout title="Reset Password">
      <form onSubmit={onSubmit} className="space-y-4">
        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        {otpDeadline != null && (
          <p className={`text-center text-sm ${expired ? 'text-red-600' : 'text-slate-500'}`}>
            {expired
              ? 'This reset code has expired. Please request a new one.'
              : `Code expires in ${formatCountdown(secondsLeft)}`}
          </p>
        )}
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="code">Reset Code</Label>
          <Input id="code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="new_password">New Password</Label>
          <Input
            id="new_password"
            type="password"
            value={form.new_password}
            onChange={(e) => setForm({ ...form, new_password: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="confirm_password">Confirm New Password</Label>
          <Input
            id="confirm_password"
            type="password"
            value={form.confirm_password}
            onChange={(e) => setForm({ ...form, confirm_password: e.target.value })}
          />
        </div>
        {expired ? (
          <Button type="button" className="w-full" onClick={() => navigate('/forgot-password')}>
            Request a new reset code
          </Button>
        ) : (
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Resetting…' : 'Reset Password'}
          </Button>
        )}
      </form>
    </AuthLayout>
  )
}
