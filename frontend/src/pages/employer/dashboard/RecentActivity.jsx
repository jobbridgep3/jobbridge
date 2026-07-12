import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Activity, FileDown, Pencil, Plus, ShieldCheck, Trash2, XCircle } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card'
import { EmptyState } from '../../../components/ui/EmptyState'
import api from '../../../lib/axios'
import { staggerContainer, staggerItem } from '../../../lib/motion'

const ACTION_ICONS = {
  Create: Plus, Update: Pencil, Delete: Trash2, Approve: ShieldCheck, Reject: XCircle, Export: FileDown,
}

export function RecentActivity() {
  const { data: activity } = useQuery({
    queryKey: ['employer', 'dashboard', 'recent-activity'],
    queryFn: async () => (await api.get('/api/employer/dashboard/recent-activity')).data.data,
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary-600" /> Recent Activities
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {!activity?.length ? (
          <EmptyState title="No recent activity yet" />
        ) : (
          <motion.div variants={staggerContainer} initial="initial" animate="animate">
            {activity.map((a) => {
              const Icon = ACTION_ICONS[a.action] || Activity
              return (
                <motion.div
                  key={a.id}
                  variants={staggerItem}
                  className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-slate-50"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-700">
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="min-w-0 flex-1 truncate text-slate-700">
                    {a.action} on {a.module.replace(/_/g, ' ')} {a.details ? `— ${a.details}` : ''}
                  </span>
                  <span className="shrink-0 text-xs text-slate-400">{new Date(a.created_at).toLocaleString()}</span>
                </motion.div>
              )
            })}
          </motion.div>
        )}
      </CardContent>
    </Card>
  )
}
