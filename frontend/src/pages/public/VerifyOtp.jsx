import { useState } from 'react'
import toast from 'react-hot-toast'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { Button } from '../../components/ui/Button'
import { Input, Label } from '../../components/ui/Input'
import api from '../../lib/axios'
import { useAuthStore } from '../../store/authStore'
import { AuthLayout } from './AuthLayout'

export default function VerifyOtp() {
  const location = useLocation()
  const navigate = useNavigate()
  const [email, setEmail] = useState(location.state?.email || '')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [error, setError] = useState(null)

  const purpose = location.state?.purpose || 'register'
  const setAuth = useAuthStore((s) => s.setAuth)

  const onSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await api.post('/api/auth/verify-otp', { email, code, purpose })
      if (purpose === 'reset_password') {
        toast.success('Verified — set your new password.')
        navigate('/reset-password', { state: { email, code } })
      } else {
        const { token, user } = res.data.data
        setAuth(token, user)
        toast.success('Account verified!')
        navigate(user.role === 'employer' ? '/employer/company' : '/complete-profile')
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid code.')
    } finally {
      setLoading(false)
    }
  }

  const resend = async () => {
    setResending(true)
    try {
      await api.post('/api/auth/resend-otp', { email, purpose })
      toast.success('A new code has been sent.')
    } catch {
      toast.error('Could not resend code.')
    } finally {
      setResending(false)
    }
  }

  return (
    <AuthLayout title="Verify Your Email" subtitle={`We sent a 6-digit code to ${email || 'your email'}`}>
      <form onSubmit={onSubmit} className="space-y-4">
        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            readOnly={!!location.state?.email}
          />
        </div>
        <div>
          <Label htmlFor="code">Verification Code</Label>
          <Input
            id="code"
            inputMode="numeric"
            maxLength={6}
            placeholder="000000"
            className="text-center text-lg tracking-[0.5em]"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          />
        </div>
        <Button type="submit" className="w-full" disabled={loading || code.length !== 6}>
          {loading ? 'Verifying…' : 'Verify'}
        </Button>
        <Button type="button" variant="link" className="w-full" onClick={resend} disabled={resending}>
          {resending ? 'Sending…' : "Didn't get a code? Resend"}
        </Button>
      </form>
      <p className="mt-4 text-center text-xs text-slate-400">
        <Link to="/login" className="hover:underline">
          Back to log in
        </Link>
      </p>
    </AuthLayout>
  )
}
