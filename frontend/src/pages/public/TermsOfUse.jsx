import { motion } from 'framer-motion'
import { ScrollText } from 'lucide-react'
import { Link } from 'react-router-dom'

import { TERMS_SECTIONS } from '../../config/legalContent'
import { fadeIn } from '../../lib/motion'

export default function TermsOfUse() {
  return (
    <motion.div {...fadeIn} className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <div className="mb-2 flex items-center gap-2 text-primary-700 dark:text-primary-400">
          <ScrollText className="h-5 w-5" />
          <span className="text-xs font-semibold uppercase tracking-wide">Legal</span>
        </div>
        <h1 className="text-xl font-semibold text-text-primary">Terms of Use</h1>
        <p className="mt-1 text-sm text-text-muted">Last updated: 2026</p>
      </div>

      <div className="space-y-5">
        {TERMS_SECTIONS.map((s) => (
          <div key={s.heading}>
            <h2 className="text-sm font-semibold text-text-primary">{s.heading}</h2>
            <p className="mt-1 text-sm leading-relaxed text-text-secondary">{s.body}</p>
          </div>
        ))}
      </div>

      <p className="text-sm text-text-muted">
        Questions about these Terms?{' '}
        <Link to="/contact" className="text-primary-700 hover:underline dark:text-primary-400">Contact PESO Pila</Link>.
      </p>
    </motion.div>
  )
}
