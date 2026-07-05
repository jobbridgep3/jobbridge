import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { z } from 'zod'

import { Button } from '../../components/ui/Button'
import { FormError, Input, Label } from '../../components/ui/Input'
import { PasswordRequirements } from '../../components/ui/PasswordRequirements'
import { isStrongPassword } from '../../lib/passwordPolicy'
import api from '../../lib/axios'
import { AuthLayout } from './AuthLayout'
import { LegalModal } from './LegalModal'

const schema = z
  .object({
    full_name: z.string().min(2, 'Enter your full name'),
    email: z.string().email('Enter a valid email address'),
    contact_number: z.string().min(7, 'Enter a valid contact number'),
    password: z.string().refine(isStrongPassword, {
      message: 'Password does not meet all the requirements below.',
    }),
    confirm_password: z.string(),
    agree_to_terms: z.boolean(),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  })
  .refine((data) => data.agree_to_terms === true, {
    message: 'You must agree to the Terms and Conditions and Privacy Policy to register.',
    path: ['agree_to_terms'],
  })

export default function Register() {
  const [searchParams] = useSearchParams()
  const isEmployer = searchParams.get('type') === 'employer'
  const navigate = useNavigate()
  const [serverError, setServerError] = useState(null)
  const [legalModal, setLegalModal] = useState(null) // 'terms' | 'privacy' | null
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: { agree_to_terms: false } })

  const passwordValue = watch('password')

  const onSubmit = async (values) => {
    setServerError(null)
    try {
      const res = await api.post(`/api/auth/register${isEmployer ? '?type=employer' : ''}`, {
        ...values,
        hr_contact_name: values.full_name,
      })
      const expiresIn = res.data?.data?.expires_in || 60
      navigate('/verify-otp', { state: { email: values.email, otpDeadline: Date.now() + expiresIn * 1000 } })
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
          <PasswordRequirements password={passwordValue} />
          <FormError>{errors.password?.message}</FormError>
        </div>
        <div>
          <Label htmlFor="confirm_password">Confirm Password</Label>
          <Input id="confirm_password" type="password" placeholder="••••••••" {...register('confirm_password')} />
          <FormError>{errors.confirm_password?.message}</FormError>
        </div>
        <div>
          <label className="flex items-start gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary-700 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary-500"
              {...register('agree_to_terms')}
            />
            <span>
              I have read and agree to the{' '}
              <button
                type="button"
                onClick={() => setLegalModal('terms')}
                className="font-medium text-primary-700 underline hover:text-primary-800"
              >
                Terms and Conditions
              </button>{' '}
              and{' '}
              <button
                type="button"
                onClick={() => setLegalModal('privacy')}
                className="font-medium text-primary-700 underline hover:text-primary-800"
              >
                Privacy Policy
              </button>{' '}
              of PESO Pila.
            </span>
          </label>
          <FormError>{errors.agree_to_terms?.message}</FormError>
        </div>
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Creating account…' : 'Create Account'}
        </Button>
      </form>

      <LegalModal open={legalModal !== null} onOpenChange={(open) => setLegalModal(open ? legalModal : null)} initialSection={legalModal || 'terms'} />
    </AuthLayout>
  )
}
