import { useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { useState } from 'react'

import { PageHeader } from '../../components/ui/PageHeader'
import { useSocket } from '../../hooks/useSocket'
import { fadeIn } from '../../lib/motion'
import { BarangaySection } from './lmi/BarangaySection'
import { EmployerIndustrySection } from './lmi/EmployerIndustrySection'
import { EmploymentFunnelSection } from './lmi/EmploymentFunnelSection'
import { JobDemandSection } from './lmi/JobDemandSection'
import { JobseekerProfileSection } from './lmi/JobseekerProfileSection'
import { KpiSection } from './lmi/KpiSection'
import { LmiExportDialog } from './lmi/LmiExportDialog'
import { LmiFilterBar } from './lmi/LmiFilterBar'
import { SkillsGapSection } from './lmi/SkillsGapSection'
import { EMPTY_LMI_FILTERS } from './lmi/lmiFilters'

/** Labor Market Information Reports & Analytics — Admin and Staff share this
 * exact page (see pages/admin/LMI.jsx, a thin re-export), matching the
 * backend's identical role_required("staff", "admin") gate on every LMI
 * route. Every section below reads from the one `filters` state lifted here,
 * so a filter change applies everywhere (KPIs, charts, tables, exports) at
 * once — and every section's React Query key shares the ['lmi', ...] prefix
 * so the single socket listener below can refresh all of them together. */
export default function StaffLMI() {
  const [filters, setFilters] = useState(EMPTY_LMI_FILTERS)
  const queryClient = useQueryClient()

  // Real-time: the backend fires 'lmi:data_updated' whenever a jobseeker/
  // employer registers, a vacancy is published, a referral is approved, an
  // interview is created, a hire is recorded, or a jobseeker's LMI-relevant
  // profile fields change (see services/lmi_service.py::notify_lmi_update
  // call sites). Each section also keeps a 60s refetchInterval fallback.
  useSocket({
    'lmi:data_updated': () => queryClient.invalidateQueries({ queryKey: ['lmi'] }),
  })

  return (
    <motion.div {...fadeIn} className="space-y-6">
      <PageHeader
        title="LMI Reports & Analytics"
        description="Labor Market Information — jobseeker supply, employer demand, skills gap, and placement outcomes for PESO Pila, Laguna."
        actions={<LmiExportDialog filters={filters} />}
      />

      <LmiFilterBar filters={filters} setFilters={setFilters} />
      <KpiSection filters={filters} />
      <JobseekerProfileSection filters={filters} />
      <JobDemandSection filters={filters} />
      <SkillsGapSection filters={filters} />
      <EmploymentFunnelSection filters={filters} />
      <EmployerIndustrySection filters={filters} />
      <BarangaySection filters={filters} />
    </motion.div>
  )
}
