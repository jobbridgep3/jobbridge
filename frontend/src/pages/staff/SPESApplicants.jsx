import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { ApplicantTable } from '../../components/spes/ApplicantTable'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { useSocket } from '../../hooks/useSocket'
import api from '../../lib/axios'

export function SPESApplicants({ batches }) {
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState({ batchId: '', status: '', search: '' })
  const debouncedSearch = useDebouncedValue(filters.search)
  const params = { batch_id: filters.batchId || undefined, status: filters.status || undefined, search: debouncedSearch || undefined }

  const { data: applications, isLoading } = useQuery({
    queryKey: ['staff', 'spes', 'applications', params],
    queryFn: async () => (await api.get('/api/staff/spes/applications', { params })).data.data,
    placeholderData: keepPreviousData,
  })

  useSocket({
    'spes:status_change': () => queryClient.invalidateQueries({ queryKey: ['staff', 'spes', 'applications'] }),
    'spes:board_update': () => queryClient.invalidateQueries({ queryKey: ['staff', 'spes', 'applications'] }),
  })

  return (
    <ApplicantTable
      applications={applications}
      isLoading={isLoading}
      batches={batches}
      filters={filters}
      onFilterChange={setFilters}
      getRowLink={(app) => `/staff/spes/applicants/${app.id}`}
    />
  )
}
