import { zodResolver } from '@hookform/resolvers/zod'
import { motion } from 'framer-motion'
import { ArrowLeft, Bell, Briefcase, Building2, Search, Send, ShieldCheck, TrendingUp, Users } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { z } from 'zod'

import logo from '../../assets/peso-logo.png'
import { BackgroundSlideshow } from '../../components/public/BackgroundSlideshow'
import { Button } from '../../components/ui/Button'
import { FormError, Input, Label } from '../../components/ui/Input'
import { PasswordInput } from '../../components/ui/PasswordInput'
import { PasswordRequirements } from '../../components/ui/PasswordRequirements'
import { LOGIN_SLIDESHOW_IMAGES } from '../../config/loginSlideshowImages'
import { isStrongPassword } from '../../lib/passwordPolicy'
import api from '../../lib/axios'
import { fadeIn } from '../../lib/motion'
import { sanitizeDigits } from '../../lib/utils'
import { LegalModal } from './LegalModal'

const schema = z
  .object({
    full_name: z.string().min(2, 'Enter your full name'),
    email: z.string().email('Enter a valid email address'),
    contact_number: z.string().regex(/^[0-9]{7,15}$/, 'Enter numbers only (7–15 digits)'),
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

const JOBSEEKER_HIGHLIGHTS = [
  { icon: Search, title: 'Find Job Opportunities', description: 'Discover job openings that match your skills and experience.' },
  { icon: Send, title: 'Easy Online Application', description: 'Apply online quickly and track your applications in one place.' },
  { icon: Bell, title: 'Stay Updated', description: 'Get notified about job fairs, announcements, and new opportunities.' },
  { icon: TrendingUp, title: 'Build Your Career', description: 'Access helpful resources to grow your skills and advance your career.' },
]

const EMPLOYER_HIGHLIGHTS = [
  { icon: ShieldCheck, title: 'Verified Platform', description: 'All employers are verified by PESO Pila to ensure a trusted hiring environment.' },
  { icon: Users, title: 'Find the Right Talent', description: 'Access a pool of qualified jobseekers matched to your organization.' },
  { icon: Briefcase, title: 'Easy Job Posting', description: 'Post vacancies, manage applications, and track your hiring process in one dashboard.' },
  { icon: Building2, title: 'Support Local Employment', description: "Be part of PESO Pila's mission to grow local employment opportunities." },
]

export default function Register() {
  const [searchParams] = useSearchParams()
  const isEmployer = searchParams.get('type') === 'employer'
  const navigate = useNavigate()
  const [serverError, setServerError] = useState(null)
  const [emailTaken, setEmailTaken] = useState(false)
  const [legalModal, setLegalModal] = useState(null) // 'terms' | 'privacy' | null
  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: { agree_to_terms: false } })

  const passwordValue = watch('password')
  const highlights = isEmployer ? EMPLOYER_HIGHLIGHTS : JOBSEEKER_HIGHLIGHTS

  const onSubmit = async (values) => {
    setServerError(null)
    setEmailTaken(false)
    try {
      const res = await api.post(`/api/auth/register${isEmployer ? '?type=employer' : ''}`, {
        ...values,
        hr_contact_name: values.full_name,
      })
      const expiresIn = res.data?.data?.expires_in || 60
      navigate('/verify-otp', { state: { email: values.email, otpDeadline: Date.now() + expiresIn * 1000 } })
    } catch (err) {
      const message = err.response?.data?.message || 'Registration failed. Please try again.'
      if (err.response?.status === 409) {
        setError('email', { type: 'manual', message })
        setEmailTaken(true)
      } else {
        setServerError(message)
      }
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4 py-10">
      <BackgroundSlideshow images={LOGIN_SLIDESHOW_IMAGES} />

      <button
        type="button"
        onClick={() => navigate(-1)}
        className="absolute left-4 top-4 z-20 inline-flex items-center gap-1.5 rounded-full bg-black/30 px-3 py-1.5 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-black/50 sm:left-6 sm:top-6"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <motion.div
        {...fadeIn}
        className="relative z-10 grid w-full max-w-4xl overflow-hidden rounded-2xl bg-surface/95 shadow-2xl backdrop-blur-sm sm:grid-cols-2"
      >
        {/* Brand / welcome panel — decorative, hidden on small screens */}
        <div className="hidden flex-col justify-center gap-6 bg-primary-50 p-8 dark:bg-primary-950/40 sm:flex">
          <Link to="/" className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm">
            <img src={logo} alt="JobBridge" className="h-8 w-8" />
          </Link>
          <div>
            <h2 className="text-xl font-semibold text-primary-900 dark:text-primary-300">
              {isEmployer ? 'Create Your Employer Account' : 'Create Your Jobseeker Account'}
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              {isEmployer
                ? 'Join JobBridge PESO Pila and connect with qualified jobseekers.'
                : 'Join JobBridge PESO Pila and discover better job opportunities.'}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {highlights.map(({ icon: Icon, title, description }) => (
              <div key={title} className="rounded-xl border border-primary-100 bg-surface/70 p-3 dark:border-primary-900/40">
                <Icon className="h-4 w-4 text-primary-700 dark:text-primary-400" />
                <p className="mt-2 text-xs font-semibold text-text-primary">{title}</p>
                <p className="mt-0.5 text-[11px] leading-snug text-text-muted">{description}</p>
              </div>
            ))}
          </div>
          <p className="rounded-xl bg-primary-100/70 px-3 py-2 text-xs text-primary-900 dark:bg-primary-900/30 dark:text-primary-200">
            {isEmployer
              ? "Together, let's build more opportunities and create better futures."
              : 'Thousands of jobseekers trust JobBridge to build better futures.'}
          </p>
        </div>

        {/* Sign-up form panel */}
        <div className="flex max-h-[90vh] flex-col overflow-y-auto p-6 sm:p-8">
          <Link to="/" className="mb-6 flex flex-col items-center text-center sm:hidden">
            <img src={logo} alt="JobBridge" className="mb-2 h-9 w-9" />
            <span className="text-lg font-semibold text-primary-900 dark:text-primary-300">JobBridge</span>
          </Link>
          <div className="mb-6">
            <h1 className="text-lg font-semibold text-text-primary">{isEmployer ? 'Register as Employer' : 'Register as Jobseeker'}</h1>
            <p className="mt-1 text-sm text-text-secondary">Fill in your information to create your account.</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {serverError && (
              <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
                {serverError}
              </div>
            )}
            <div>
              <Label htmlFor="full_name">{isEmployer ? 'HR Contact Name' : 'Full Name'}</Label>
              <Input id="full_name" placeholder="Juan Dela Cruz" {...register('full_name')} />
              <FormError>{errors.full_name?.message}</FormError>
            </div>
            <div>
              <Label htmlFor="email">Email Address</Label>
              <Input id="email" type="email" placeholder="you@example.com" {...register('email')} />
              <FormError>{errors.email?.message}</FormError>
              {emailTaken && (
                <p className="mt-1 text-xs text-text-muted">
                  <Link to="/login" className="font-medium text-primary-700 hover:underline dark:text-primary-400">
                    Log in instead
                  </Link>
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="contact_number">Contact Number</Label>
              <Input
                id="contact_number"
                placeholder="09171234567"
                inputMode="numeric"
                maxLength={15}
                {...register('contact_number', {
                  onChange: (e) => {
                    e.target.value = sanitizeDigits(e.target.value)
                  },
                })}
              />
              <FormError>{errors.contact_number?.message}</FormError>
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <PasswordInput id="password" placeholder="••••••••" {...register('password')} />
              <PasswordRequirements password={passwordValue} />
              <FormError>{errors.password?.message}</FormError>
            </div>
            <div>
              <Label htmlFor="confirm_password">Confirm Password</Label>
              <PasswordInput id="confirm_password" placeholder="••••••••" {...register('confirm_password')} />
              <FormError>{errors.confirm_password?.message}</FormError>
            </div>
            <div>
              <label className="flex items-start gap-2 text-sm text-text-secondary">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-border-hover text-primary-700 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary-500"
                  {...register('agree_to_terms')}
                />
                <span>
                  I have read and agree to the{' '}
                  <button
                    type="button"
                    onClick={() => setLegalModal('terms')}
                    className="font-medium text-primary-700 underline hover:text-primary-800 dark:text-primary-400"
                  >
                    Terms and Conditions
                  </button>{' '}
                  and{' '}
                  <button
                    type="button"
                    onClick={() => setLegalModal('privacy')}
                    className="font-medium text-primary-700 underline hover:text-primary-800 dark:text-primary-400"
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

          <p className="mt-4 text-center text-sm text-text-secondary">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-primary-700 hover:underline dark:text-primary-400">
              Log In
            </Link>
          </p>

          <LegalModal open={legalModal !== null} onOpenChange={(open) => setLegalModal(open ? legalModal : null)} initialSection={legalModal || 'terms'} />
        </div>
      </motion.div>
    </div>
  )
}
