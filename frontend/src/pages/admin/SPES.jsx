import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { useState } from 'react'

import { PageHeader } from '../../components/ui/PageHeader'
import api from '../../lib/axios'
import { fadeIn } from '../../lib/motion'
import { cn } from '../../lib/utils'
import { SPESApplicantOversight } from './SPESApplicantOversight'
import { SPESBatchManagement } from './SPESBatchManagement'
import { SPESOverview } from './SPESOverview'

const TABS = [
  { key: 'overview', label: 'Program Overview' },
  { key: 'batches', label: 'Batch Management' },
  { key: 'applicants', label: 'Applicant Oversight' },
]

export default function AdminSPES() {
  const [tab, setTab] = useState('overview')

  const { data: batches } = useQuery({
    queryKey: ['admin', 'spes', 'batches', 'picker'],
    queryFn: async () => (await api.get('/api/staff/spes/batches')).data.data,
  })

  return (
    <motion.div {...fadeIn} className="space-y-4">
      <PageHeader
        title="SPES Management"
        description="System-wide oversight of the SPES program — create and manage batches, and view reports across all batches. Day-to-day operations (review, scheduling, scanning, encoding results, PESO appointments) are handled by PESO Staff."
      />

      <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-surface p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-medium sm:text-sm',
              tab === t.key ? 'bg-primary-800 text-white' : 'text-text-secondary hover:bg-surface-hover'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && <SPESOverview />}
      {tab === 'batches' && <SPESBatchManagement />}
      {tab === 'applicants' && <SPESApplicantOversight batches={batches} />}
    </motion.div>
  )
}
