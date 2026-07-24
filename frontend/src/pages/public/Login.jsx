import { zodResolver } from '@hookform/resolvers/zod'
import { motion } from 'framer-motion'
import { Bell, Search, Send, ShieldCheck } from 'lucide-react'
import { useRef, useState } from 'react'
import ReCAPTCHA from 'react-google-recaptcha'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { z } from 'zod'

import logo from '../../assets/peso-logo.png'
import { BackgroundSlideshow } from '../../components/public/BackgroundSlideshow'
import { Button } from '../../components/ui/Button'
import { FormError, Input, Label } from '../../components/ui/Input'
import { PasswordInput } from '../../components/ui/PasswordInput'
import { ROLE_DASHBOARD } from '../../config/navigation'
import { LOGIN_SLIDESHOW_IMAGES } from '../../config/loginSlideshowImages'
import api from '../../lib/axios'
import { fadeIn } from '../../lib/motion'
import { useAuthStore } from '../../store/authStore'

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

const HIGHLIGHTS = [
  { icon: Search, title: 'Find Opportunities', description: 'Discover job openings that match your skills and experience.' },
  { icon: Send, title: 'Easy Application', description: 'Apply online and track every application in one place.' },
  { icon: Bell, title: 'Stay Updated', description: 'Get notified about referrals, job fairs, and announcements.' },
  { icon: ShieldCheck, title: 'Secure & Trusted', description: 'Your information is protected under PESO Pila, Laguna.' },
]

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [serverError, setServerError] = useState(null)
  const [recaptchaToken, setRecaptchaToken] = useState(null)
  const recaptchaRef = useRef(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) })

  const onSubmit = async (values) => {
    setServerError(null)
    try {
      const res = await api.post('/api/auth/login', { ...values, recaptcha_token: recaptchaToken })
      const { token, user } = res.data.data
      setAuth(token, user)
      toast.success('Welcome back!')
      const from = location.state?.from
      navigate(from ? `${from.pathname}${from.search || ''}` : ROLE_DASHBOARD[user.role] || '/')
    } catch (err) {
      setServerError(err.response?.data?.message || 'Login failed. Please try again.')
      // A reCAPTCHA token is single-use (Google's siteverify consumes it on the very
      // first check, win or lose), so a failed attempt must reset the widget --
      // otherwise the *next* submit would fail on an already-spent token and show a
      // confusing "reCAPTCHA failed" instead of the real error (e.g. wrong password).
      recaptchaRef.current?.reset()
      setRecaptchaToken(null)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4 py-10">
      <BackgroundSlideshow images={LOGIN_SLIDESHOW_IMAGES} />

      <motion.div
        {...fadeIn}
        className="relative z-10 grid w-full max-w-4xl overflow-hidden rounded-2xl bg-white/95 shadow-2xl backdrop-blur-sm sm:grid-cols-2"
      >
        {/* Brand / welcome panel — decorative, hidden on small screens */}
        <div className="hidden flex-col justify-center gap-6 bg-primary-50/80 p-8 sm:flex">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm">
            <img src={logo} alt="JobBridge" className="h-8 w-8" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-primary-950">Welcome Back!</h2>
            <p className="mt-1 text-sm text-slate-600">Log in to your JobBridge account to continue.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {HIGHLIGHTS.map(({ icon: Icon, title, description }) => (
              <div key={title} className="rounded-xl border border-primary-100 bg-white/70 p-3">
                <Icon className="h-4 w-4 text-primary-700" />
                <p className="mt-2 text-xs font-semibold text-slate-900">{title}</p>
                <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{description}</p>
              </div>
            ))}
          </div>
          <p className="rounded-xl bg-primary-100/70 px-3 py-2 text-xs text-primary-900">
            Join thousands of jobseekers and employers building better futures together.
          </p>
        </div>

        {/* Sign-in form panel */}
        <div className="flex flex-col justify-center p-6 sm:p-8">
          <div className="mb-6 flex flex-col items-center text-center sm:hidden">
            <img src={logo} alt="JobBridge" className="mb-2 h-9 w-9" />
            <span className="text-lg font-semibold text-primary-900">JobBridge</span>
          </div>
          <div className="mb-6">
            <h1 className="text-lg font-semibold text-slate-900">Sign in to your account</h1>
            <p className="mt-1 text-sm text-slate-500">Welcome back! Please enter your credentials.</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {serverError && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{serverError}</div>}
            <div>
              <Label htmlFor="email">Email Address</Label>
              <Input id="email" type="email" placeholder="Enter your email address" {...register('email')} />
              <FormError>{errors.email?.message}</FormError>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link to="/forgot-password" className="text-xs font-medium text-primary-700 hover:underline">
                  Forgot Password?
                </Link>
              </div>
              <PasswordInput id="password" placeholder="Enter your password" {...register('password')} />
              <FormError>{errors.password?.message}</FormError>
            </div>
            <div>
              <ReCAPTCHA
                ref={recaptchaRef}
                sitekey={import.meta.env.VITE_RECAPTCHA_SITE_KEY}
                onChange={(token) => setRecaptchaToken(token)}
                onExpired={() => setRecaptchaToken(null)}
                onErrored={() => setRecaptchaToken(null)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting || !recaptchaToken}>
              {isSubmitting ? 'Logging in…' : 'Log In'}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-slate-500">
            Don&apos;t have an account?{' '}
            <Link to="/register" className="font-medium text-primary-700 hover:underline">
              Register as Jobseeker
            </Link>{' '}
            or{' '}
            <Link to="/register?type=employer" className="font-medium text-primary-700 hover:underline">
              Employer
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  )
}
