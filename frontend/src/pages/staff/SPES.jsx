import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { useState } from 'react'

import { PageHeader } from '../../components/ui/PageHeader'
import api from '../../lib/axios'
import { fadeIn } from '../../lib/motion'
import { cn } from '../../lib/utils'
import { SPESApplicants } from './SPESApplicants'
import { SPESBatchSchedule } from './SPESBatchSchedule'
import { SPESDashboard } from './SPESDashboard'
import { SPESDeployment } from './SPESDeployment'
import { SPESDtrReview } from './SPESDtrReview'
import { SPESOutcomes } from './SPESOutcomes'
import { SPESReports } from './SPESReports'
import { SPESScanner } from './SPESScanner'

const TABS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'applicants', label: 'Applicants' },
  { key: 'scanner', label: 'Attendance Scanner' },
  { key: 'schedules', label: 'Schedules' },
  { key: 'outcomes', label: 'Outcomes & Results' },
  { key: 'deployment', label: 'Deployment' },
  { key: 'dtr', label: 'DTR Review' },
  { key: 'reports', label: 'Reports' },
]

export default function StaffSPES() {
  const [tab, setTab] = useState('dashboard')

  const { data: batches } = useQuery({
    queryKey: ['staff', 'spes', 'batches'],
    queryFn: async () => (await api.get('/api/staff/spes/batches')).data.data,
  })

  return (
    <motion.div {...fadeIn} className="space-y-4">
      <PageHeader
        title="SPES Management"
        description="Review applications, schedule orientation/exam, scan attendance, encode results, assign deployment, and review DTR submissions."
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

      {tab === 'dashboard' && <SPESDashboard batches={batches} onNavigate={setTab} />}
      {tab === 'applicants' && <SPESApplicants batches={batches} />}
      {tab === 'scanner' && <SPESScanner batches={batches} />}
      {tab === 'schedules' && <SPESBatchSchedule batches={batches} />}
      {tab === 'outcomes' && <SPESOutcomes batches={batches} />}
      {tab === 'deployment' && <SPESDeployment />}
      {tab === 'dtr' && <SPESDtrReview />}
      {tab === 'reports' && <SPESReports batches={batches} />}
    </motion.div>
  )
}
