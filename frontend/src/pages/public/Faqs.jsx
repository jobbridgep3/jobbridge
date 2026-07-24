import { motion } from 'framer-motion'
import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'

import { Accordion } from '../../components/ui/Accordion'
import { EmptyState } from '../../components/ui/EmptyState'
import { Input } from '../../components/ui/Input'
import { FAQS } from '../../config/faqContent'
import { fadeIn } from '../../lib/motion'

export default function Faqs() {
  const [query, setQuery] = useState('')

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = q
      ? FAQS.filter((f) => f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q))
      : FAQS

    const byCategory = new Map()
    for (const faq of filtered) {
      if (!byCategory.has(faq.category)) byCategory.set(faq.category, [])
      byCategory.get(faq.category).push(faq)
    }
    return byCategory
  }, [query])

  return (
    <motion.div {...fadeIn} className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">Frequently Asked Questions</h1>
        <p className="mt-1 text-sm text-text-muted">Answers to common questions about using JobBridge and PESO Pila's services.</p>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search FAQs…" className="pl-9" />
      </div>

      {grouped.size === 0 ? (
        <EmptyState icon={Search} title="No matching questions" description="Try a different search term, or contact us directly." />
      ) : (
        Array.from(grouped.entries()).map(([category, faqs]) => (
          <div key={category} className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{category}</p>
            <Accordion items={faqs} />
          </div>
        ))
      )}
    </motion.div>
  )
}
