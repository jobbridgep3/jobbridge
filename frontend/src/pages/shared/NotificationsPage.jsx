import { useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { motion } from 'framer-motion'
import { Bell, CheckCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { Button } from '../../components/ui/Button'
import { Card, CardContent } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { CardSkeleton } from '../../components/ui/Skeleton'
import { useSocket } from '../../hooks/useSocket'
import api from '../../lib/axios'
import { cn } from '../../lib/utils'
import { fadeIn, staggerContainer, staggerItem } from '../../lib/motion'
import { useUiStore } from '../../store/uiStore'

dayjs.extend(relativeTime)

export function NotificationsPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const setUnreadCount = useUiStore((s) => s.setUnreadCount)

  const { data: notifications, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => (await api.get('/api/notifications')).data.data,
  })

  useSocket({ 'notification:new': () => queryClient.invalidateQueries({ queryKey: ['notifications'] }) })

  const markRead = async (id) => {
    await api.put('/api/notifications/mark-read', { id })
    queryClient.invalidateQueries({ queryKey: ['notifications'] })
  }

  const markAllRead = async () => {
    await api.put('/api/notifications/mark-all-read')
    setUnreadCount(0)
    queryClient.invalidateQueries({ queryKey: ['notifications'] })
  }

  return (
    <motion.div {...fadeIn} className="space-y-4">
      <PageHeader
        title="Notifications"
        description="Real-time alerts for every action relevant to you."
        actions={
          <Button variant="secondary" size="sm" onClick={markAllRead}>
            <CheckCheck className="h-4 w-4" /> Mark all as read
          </Button>
        }
      />

      {isLoading ? (
        <CardSkeleton />
      ) : !notifications?.length ? (
        <EmptyState icon={Bell} title="No notifications yet" />
      ) : (
        <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-2">
          {notifications.map((n) => (
            <motion.div key={n.id} variants={staggerItem}>
              <Card
                className={cn('cursor-pointer', !n.is_read && 'border-primary-200 bg-primary-50/40')}
                onClick={() => {
                  markRead(n.id)
                  if (n.link) navigate(n.link)
                }}
              >
                <CardContent className="flex items-start justify-between gap-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{n.title}</p>
                    {n.message && <p className="text-xs text-slate-500">{n.message}</p>}
                    <p className="mt-1 text-[11px] text-slate-400">{dayjs(n.created_at).fromNow()}</p>
                  </div>
                  {!n.is_read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary-600" />}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}
    </motion.div>
  )
}
