import { useQuery } from '@tanstack/react-query'
import { BarChart2, Megaphone, ScrollText, UserCog, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Button } from '../../../components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card'
import api from '../../../lib/axios'

const ACTIONS = [
  { label: 'Create Staff Account', to: '/admin/staff/create', icon: UserCog },
  { label: 'Create Job Fair', to: '/admin/jobfair', icon: Megaphone },
  { label: 'Create Announcement', to: '/admin/announcements', icon: Megaphone },
  { label: 'View Reports', to: '/admin/lmi', icon: BarChart2 },
  { label: 'View Audit Trail', to: '/admin/audit', icon: ScrollText },
]

export function QuickActions() {
  const { data: staffList } = useQuery({
    queryKey: ['admin', 'staff'],
    queryFn: async () => (await api.get('/api/admin/staff')).data.data,
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary-600" /> Quick Actions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-3">
          {ACTIONS.map(({ label, to, icon: Icon }) => (
            <Button key={label} asChild variant={label === 'Create Staff Account' ? 'primary' : 'secondary'} size="sm">
              <Link to={to}>
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            </Button>
          ))}
        </div>
        {staffList && (
          <p className="mt-3 text-xs text-slate-400">{staffList.length} PESO staff account{staffList.length === 1 ? '' : 's'}</p>
        )}
      </CardContent>
    </Card>
  )
}
