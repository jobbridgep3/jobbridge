import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import { ApplicantTable } from '../../components/spes/ApplicantTable'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import api from '../../lib/axios'

/** Read-only mirror of Staff's Applicants tab — no getRowLink is passed to
 * ApplicantTable, so no action column/detail drill-down renders here, matching
 * Admin's view-only scope for day-to-day SPES operations (approve/reject etc. are
 * Staff-only, enforced server-side regardless of what this page renders). */
export function SPESApplicantOversight({ batches }) {
  const [filters, setFilters] = useState({ batchId: '', status: '', search: '' })
  const debouncedSearch = useDebouncedValue(filters.search)
  const params = { batch_id: filters.batchId || undefined, status: filters.status || undefined, search: debouncedSearch || undefined }

  const { data: applications, isLoading } = useQuery({
    queryKey: ['admin', 'spes', 'applications', params],
    queryFn: async () => (await api.get('/api/admin/spes/applications', { params })).data.data,
    placeholderData: keepPreviousData,
  })

  return (
    <ApplicantTable
      applications={applications}
      isLoading={isLoading}
      batches={batches}
      filters={filters}
      onFilterChange={setFilters}
    />
  )
}
