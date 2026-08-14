import { useQuery } from '@tanstack/react-query'
import { CalendarClock, CheckCircle2, ClipboardList, GraduationCap, ScanLine, Users } from 'lucide-react'
import { useState } from 'react'

import { Button } from '../../components/ui/Button'
import { Card, CardContent } from '../../components/ui/Card'
import { Label, Select } from '../../components/ui/Input'
import { StatCard } from '../../components/ui/StatCard'
import { ChartSkeleton } from '../../components/ui/Skeleton'
import api from '../../lib/axios'

export function SPESDashboard({ batches, onNavigate }) {
  const [batchId, setBatchId] = useState('')

  const { data: stats, isLoading } = useQuery({
    queryKey: ['staff', 'spes', 'dashboard', batchId],
    queryFn: async () => (await api.get('/api/staff/spes/dashboard', { params: { batch_id: batchId || undefined } })).data.data,
  })

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-end justify-between gap-4">
          <div className="w-full max-w-xs">
            <Label>Batch</Label>
            <Select value={batchId} onChange={(e) => setBatchId(e.target.value)}>
              <option value="">All Batches</option>
              {(batches || []).map((b) => (
                <option key={b.id} value={b.id}>{b.batch_name}</option>
              ))}
            </Select>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => onNavigate('applicants')}>
              <ClipboardList className="h-4 w-4" /> Review Applications
            </Button>
            <Button size="sm" variant="secondary" onClick={() => onNavigate('scanner')}>
              <ScanLine className="h-4 w-4" /> Scan Attendance
            </Button>
            <Button size="sm" variant="secondary" onClick={() => onNavigate('outcomes')}>
              <CheckCircle2 className="h-4 w-4" /> Encode Results
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading || !stats ? (
        <ChartSkeleton />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard label="Total Applicants" value={stats.total_applicants} icon={Users} tone="primary" />
          <StatCard label="Pending Review" value={stats.pending_review} icon={ClipboardList} tone="warning" />
          <StatCard label="For Orientation" value={stats.approved_for_orientation} icon={CalendarClock} tone="primary" />
          <StatCard label="For Exam" value={stats.currently_orientation_passed} icon={GraduationCap} tone="primary" />
          <StatCard label="Exam Passed" value={stats.exam_passed} icon={CheckCircle2} tone="success" />
        </div>
      )}
    </div>
  )
}
