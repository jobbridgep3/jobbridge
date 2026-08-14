import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { useState } from 'react'
import toast from 'react-hot-toast'

import { Button } from '../../components/ui/Button'
import { Card, CardContent } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Input, Label, Select } from '../../components/ui/Input'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { TableSkeleton } from '../../components/ui/Skeleton'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import api from '../../lib/axios'

export function SPESDtrReview() {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState('pending')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search)
  const params = { status: status || undefined, search: debouncedSearch || undefined }

  const { data: entries, isLoading } = useQuery({
    queryKey: ['staff', 'spes', 'dtr', params],
    queryFn: async () => (await api.get('/api/staff/spes/dtr', { params })).data.data,
    placeholderData: keepPreviousData,
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['staff', 'spes', 'dtr'] })

  const approve = useMutation({
    mutationFn: (id) => api.put(`/api/staff/spes/dtr/${id}/approve`),
    onSuccess: () => { toast.success('DTR entry approved.'); invalidate() },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not approve this entry.'),
  })
  const reject = useMutation({
    mutationFn: (id) => api.put(`/api/staff/spes/dtr/${id}/reject`),
    onSuccess: () => { toast.success('DTR entry rejected.'); invalidate() },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not reject this entry.'),
  })

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label>Status</Label>
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </Select>
          </div>
          <div>
            <Label>Search Applicant</Label>
            <Input placeholder="Search by name…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <TableSkeleton />
      ) : !entries?.length ? (
        <EmptyState title="No DTR entries match these filters" />
      ) : (
        <div className="space-y-2">
          {entries.map((e) => (
            <Card key={e.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-text-primary">{e.jobseeker_name}</p>
                  <p className="text-xs text-text-muted">{dayjs(e.work_date).format('MMM D, YYYY')} · {e.time_in}–{e.time_out}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={e.status} />
                  {e.status === 'pending' && (
                    <>
                      <Button size="sm" onClick={() => approve.mutate(e.id)} disabled={approve.isPending}>Approve</Button>
                      <Button size="sm" variant="danger" onClick={() => reject.mutate(e.id)} disabled={reject.isPending}>Reject</Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
