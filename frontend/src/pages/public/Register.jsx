import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { z } from 'zod'

import { Button } from '../../components/ui/Button'
import { FormError, Input, Label } from '../../components/ui/Input'
import api from '../../lib/axios'
import { AuthLayout } from './AuthLayout'

const schema = z
  .object({
    full_name: z.string().min(2, 'Enter your full name'),
    email: z.string().email('Enter a valid email address'),
    contact_number: z.string().min(7, 'Enter a valid contact number'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirm_password: z.string(),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  })

export default function Register() {
  const [searchParams] = useSearchParams()
  const isEmployer = searchParams.get('type') === 'employer'
  const navigate = useNavigate()
  const [serverError, setServerError] = useState(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) })

  const onSubmit = async (values) => {
    setServerError(null)
    try {
      await api.post(`/api/auth/register${isEmployer ? '?type=employer' : ''}`, {
        ...values,
        hr_contact_name: values.full_name,
      })
      navigate('/verify-otp', { state: { email: values.email } })
    } catch (err) {
      setServerError(err.response?.data?.message || 'Registration failed. Please try again.')
    }
  }

  return (
    <AuthLayout
      title={isEmployer ? 'Register as Employer' : 'Register as Jobseeker'}
      subtitle="PESO Pila, Laguna"
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-primary-700 hover:underline">
            Log In
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {serverError && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{serverError}</div>}
        <div>
          <Label htmlFor="full_name">{isEmployer ? 'HR Contact Name' : 'Full Name'}</Label>
          <Input id="full_name" placeholder="Juan Dela Cruz" {...register('full_name')} />
          <FormError>{errors.full_name?.message}</FormError>
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" placeholder="you@example.com" {...register('email')} />
          <FormError>{errors.email?.message}</FormError>
        </div>
        <div>
          <Label htmlFor="contact_number">Contact Number</Label>
          <Input id="contact_number" placeholder="09171234567" {...register('contact_number')} />
          <FormError>{errors.contact_number?.message}</FormError>
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" placeholder="••••••••" {...register('password')} />
          <FormError>{errors.password?.message}</FormError>
        </div>
        <div>
          <Label htmlFor="confirm_password">Confirm Password</Label>
          <Input id="confirm_password" type="password" placeholder="••••••••" {...register('confirm_password')} />
          <FormError>{errors.confirm_password?.message}</FormError>
        </div>
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Creating account…' : 'Create Account'}
        </Button>
      </form>
    </AuthLayout>
  )
}
