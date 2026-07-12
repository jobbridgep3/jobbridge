import { useQuery } from '@tanstack/react-query'
import { ClipboardList } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Badge } from '../../../components/ui/Badge'
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card'
import api from '../../../lib/axios'

export function PendingActionsPanel() {
  const { data: pending } = useQuery({
    queryKey: ['admin', 'dashboard', 'pending-actions'],
    queryFn: async () => (await api.get('/api/admin/dashboard/pending-actions')).data.data,
    refetchInterval: 60_000,
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-primary-600" /> Pending Actions
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-3">
        <Link to="/admin/employers?accreditation_status=pending_review">
          <Badge variant="warning" className="px-3 py-1.5">
            {pending?.pending_employer_verifications ?? 0} Employer Verifications
          </Badge>
        </Link>
        <Link to="/admin/vacancies?status=pending">
          <Badge variant="warning" className="px-3 py-1.5">
            {pending?.pending_job_approvals ?? 0} Job Approvals
          </Badge>
        </Link>
        <Link to="/admin/interviews?status=pending">
          <Badge variant="warning" className="px-3 py-1.5">
            {pending?.pending_interviews ?? 0} Interviews Pending
          </Badge>
        </Link>
        {/* Composite of flagged jobseeker profiles + flagged employment records — no
            single management page covers both, so this one isn't a link. */}
        <Badge variant="warning" className="px-3 py-1.5">
          {pending?.pending_reports ?? 0} Flagged Reports
        </Badge>
      </CardContent>
    </Card>
  )
}
