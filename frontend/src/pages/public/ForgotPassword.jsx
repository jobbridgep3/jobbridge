import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Button } from '../../components/ui/Button'
import { Input, Label } from '../../components/ui/Input'
import api from '../../lib/axios'
import { AuthLayout } from './AuthLayout'

export default function ForgotPassword() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const onSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await api.post('/api/auth/forgot-password', { email })
      const expiresIn = res.data?.data?.expires_in || 300
      setSent(true)
      setTimeout(
        () =>
          navigate('/verify-otp', {
            state: { email, purpose: 'reset_password', otpDeadline: Date.now() + expiresIn * 1000 },
          }),
        1500
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout title="Forgot Password" subtitle="We'll email you a reset code">
      {sent ? (
        <p className="text-sm text-slate-600">If that email is registered, a reset code has been sent. Redirecting…</p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Sending…' : 'Send Reset Code'}
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}
