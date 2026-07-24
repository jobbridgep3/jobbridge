import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { useState } from 'react'

import { slideDown } from '../../lib/motion'
import { cn } from '../../lib/utils'

/** Lightweight single-open-at-a-time disclosure list — no external dependency,
 * matching the app's existing hand-rolled toggle patterns (e.g. LegalModal's
 * tab switcher, PublicHeader's mobile menu). */
export function Accordion({ items, className }) {
  const [openIndex, setOpenIndex] = useState(null)

  return (
    <div className={cn('divide-y divide-border-subtle rounded-xl border border-border bg-surface', className)}>
      {items.map((item, i) => {
        const open = openIndex === i
        return (
          <div key={item.question}>
            <button
              type="button"
              onClick={() => setOpenIndex(open ? null : i)}
              aria-expanded={open}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-medium text-text-primary hover:bg-surface-hover"
            >
              {item.question}
              <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.15 }} className="shrink-0 text-text-muted">
                <ChevronDown className="h-4 w-4" />
              </motion.span>
            </button>
            <AnimatePresence initial={false}>
              {open && (
                <motion.div {...slideDown} className="overflow-hidden">
                  <p className="px-5 pb-4 text-sm text-text-secondary">{item.answer}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}
    </div>
  )
}
