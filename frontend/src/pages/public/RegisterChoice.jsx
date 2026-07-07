import { motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Briefcase, Check, UserRound } from 'lucide-react'
import { Link } from 'react-router-dom'

import logo from '../../assets/peso-logo.png'
import { Card } from '../../components/ui/Card'
import { fadeIn, staggerContainer, staggerItem } from '../../lib/motion'

const ROLES = [
  {
    to: '/register',
    icon: UserRound,
    title: "I'm looking for a job",
    description:
      'Create a jobseeker profile, get OCR-assisted resume parsing, and let our AI match you to vacancies verified by PESO Pila.',
    bullets: ['Free AI-powered job matching', 'Track your applications in one place', 'Apply to PESO-verified employers'],
  },
  {
    to: '/register?type=employer',
    icon: Briefcase,
    title: "I'm hiring",
    description: 'Register your company to post vacancies, review applicants, and get verified by PESO Pila, Laguna.',
    bullets: ['Post unlimited vacancies', 'Review AI-ranked applicants', 'Get a PESO verification badge'],
  },
]

export default function RegisterChoice() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <motion.div {...fadeIn} className="w-full max-w-3xl">
        <div className="mb-8 flex flex-col items-center text-center">
          <Link to="/" className="mb-3 flex items-center gap-2">
            <img src={logo} alt="JobBridge" className="h-9 w-9" />
            <span className="text-xl font-semibold text-primary-900">JobBridge</span>
          </Link>
          <h1 className="text-lg font-semibold text-slate-900">How would you like to register?</h1>
          <p className="mt-1 text-sm text-slate-500">Choose the option that best describes you.</p>
        </div>

        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="grid grid-cols-1 gap-6 sm:grid-cols-2"
        >
          {ROLES.map((role) => (
            <motion.div key={role.title} variants={staggerItem}>
              <Link to={role.to} className="block h-full">
                <Card hover className="flex h-full flex-col p-6">
                  <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-primary-50 text-primary-700">
                    <role.icon className="h-5 w-5" />
                  </div>
                  <h2 className="text-base font-semibold text-slate-900">{role.title}</h2>
                  <p className="mt-1 text-sm text-slate-500">{role.description}</p>
                  <ul className="mt-4 flex-1 space-y-2">
                    {role.bullets.map((bullet) => (
                      <li key={bullet} className="flex items-start gap-2 text-sm text-slate-600">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary-700" />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-5 flex items-center gap-1 text-sm font-medium text-primary-700">
                    Continue
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </Card>
              </Link>
            </motion.div>
          ))}
        </motion.div>

        <div className="mt-8 flex flex-col items-center gap-2 text-sm text-slate-500">
          <Link to="/" className="flex items-center gap-1 hover:text-slate-700">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
          <p>
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-primary-700 hover:underline">
              Log In
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  )
}
