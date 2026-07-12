import { useQuery } from '@tanstack/react-query'
import { ClipboardList } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Badge } from '../../../components/ui/Badge'
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card'
import { EmptyState } from '../../../components/ui/EmptyState'
import api from '../../../lib/axios'

export function PendingActionsPanel() {
  const { data } = useQuery({
    queryKey: ['employer', 'dashboard', 'pending-actions'],
    queryFn: async () => (await api.get('/api/employer/dashboard/pending-actions')).data.data,
    refetchInterval: 60_000,
  })

  const items = []
  if (data?.complete_company_profile) items.push({ label: 'Complete Company Profile', to: '/employer/company' })
  if (data?.complete_hr_profile) items.push({ label: 'Complete Your Profile', to: '/employer/profile' })
  for (const doc of data?.missing_documents || []) {
    items.push({ label: `Upload ${doc}`, to: '/employer/company' })
  }
  if (data?.can_submit_accreditation) items.push({ label: 'Submit for Accreditation', to: '/employer/company' })
  if (data?.vacancies_awaiting_approval) {
    items.push({ label: `${data.vacancies_awaiting_approval} Vacancy(ies) Awaiting Approval`, to: '/employer/vacancies?status=pending' })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-primary-600" /> Pending Actions
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-3">
        {!items.length ? (
          <EmptyState title="Nothing pending — you're all caught up" />
        ) : (
          items.map((item) => (
            <Link key={item.label} to={item.to}>
              <Badge variant="warning" className="px-3 py-1.5">{item.label}</Badge>
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  )
}
