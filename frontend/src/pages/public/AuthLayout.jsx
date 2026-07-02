import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'

import logo from '../../assets/peso-logo.png'
import { fadeIn } from '../../lib/motion'

export function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <motion.div {...fadeIn} className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <Link to="/" className="mb-3 flex items-center gap-2">
            <img src={logo} alt="JobBridge" className="h-9 w-9" />
            <span className="text-xl font-semibold text-primary-900">JobBridge</span>
          </Link>
          <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-[var(--shadow-card)]">{children}</div>
        {footer && <p className="mt-4 text-center text-sm text-slate-500">{footer}</p>}
      </motion.div>
    </div>
  )
}
