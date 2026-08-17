import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { useState } from 'react'

import { PageHeader } from '../../components/ui/PageHeader'
import api from '../../lib/axios'
import { fadeIn } from '../../lib/motion'
import { cn } from '../../lib/utils'
import { SPESAppointments } from './SPESAppointments'
import { SPESBatchSchedule } from './SPESBatchSchedule'
import { SPESDashboard } from './SPESDashboard'
import { SPESOutcomes } from './SPESOutcomes'
import { SPESScanner } from './SPESScanner'

const TABS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'schedules', label: 'Schedules' },
  { key: 'scanner', label: 'Attendance Scanner' },
  { key: 'outcomes', label: 'Outcomes & Results' },
  { key: 'appointments', label: 'PESO Appointments' },
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
        description="Review applications, schedule orientation/exam, scan attendance, encode results, and set PESO Office appointments for applicants who pass."
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
      {tab === 'schedules' && <SPESBatchSchedule batches={batches} />}
      {tab === 'scanner' && <SPESScanner batches={batches} />}
      {tab === 'outcomes' && <SPESOutcomes batches={batches} />}
      {tab === 'appointments' && <SPESAppointments />}
    </motion.div>
  )
}
