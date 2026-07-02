import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'

import { Button } from '../../components/ui/Button'
import { FormError, Input, Label } from '../../components/ui/Input'
import { ROLE_DASHBOARD } from '../../config/navigation'
import api from '../../lib/axios'
import { useAuthStore } from '../../store/authStore'
import { AuthLayout } from './AuthLayout'

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

export default function Login() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [serverError, setServerError] = useState(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) })

  const onSubmit = async (values) => {
    setServerError(null)
    try {
      const res = await api.post('/api/auth/login', values)
      const { token, user } = res.data.data
      setAuth(token, user)
      toast.success('Welcome back!')
      navigate(ROLE_DASHBOARD[user.role] || '/')
    } catch (err) {
      setServerError(err.response?.data?.message || 'Login failed. Please try again.')
    }
  }

  return (
    <AuthLayout
      title="Log in to JobBridge"
      subtitle="PESO Pila, Laguna"
      footer={
        <>
          Don&apos;t have an account?{' '}
          <Link to="/register" className="font-medium text-primary-700 hover:underline">
            Register as Jobseeker
          </Link>{' '}
          or{' '}
          <Link to="/register?type=employer" className="font-medium text-primary-700 hover:underline">
            Employer
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {serverError && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{serverError}</div>}
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" placeholder="you@example.com" {...register('email')} />
          <FormError>{errors.email?.message}</FormError>
        </div>
        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link to="/forgot-password" className="text-xs text-primary-700 hover:underline">
              Forgot password?
            </Link>
          </div>
          <Input id="password" type="password" placeholder="••••••••" {...register('password')} />
          <FormError>{errors.password?.message}</FormError>
        </div>
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Logging in…' : 'Log In'}
        </Button>
      </form>
    </AuthLayout>
  )
}
