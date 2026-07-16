import { useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { motion } from 'framer-motion'
import { Archive, Bell, CheckCheck, Search, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card, CardContent } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Input } from '../../components/ui/Input'
import { PageHeader } from '../../components/ui/PageHeader'
import { CardSkeleton } from '../../components/ui/Skeleton'
import { isClickable, resolveIcon, resolvePriority } from '../../config/notificationMeta'
import { useSocket } from '../../hooks/useSocket'
import api from '../../lib/axios'
import { cn } from '../../lib/utils'
import { fadeIn, staggerContainer, staggerItem } from '../../lib/motion'
import { useUiStore } from '../../store/uiStore'

dayjs.extend(relativeTime)

const FILTER_TABS = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'read', label: 'Read' },
]

function groupByDate(notifications) {
  const groups = { Today: [], Yesterday: [], 'This Week': [], Older: [] }
  const now = dayjs()
  for (const n of notifications) {
    const d = dayjs(n.created_at)
    if (now.isSame(d, 'day')) groups.Today.push(n)
    else if (now.subtract(1, 'day').isSame(d, 'day')) groups.Yesterday.push(n)
    else if (now.diff(d, 'day') < 7) groups['This Week'].push(n)
    else groups.Older.push(n)
  }
  return Object.entries(groups).filter(([, items]) => items.length > 0)
}

export function NotificationsPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const setUnreadCount = useUiStore((s) => s.setUnreadCount)
  const decrementUnread = useUiStore((s) => s.decrementUnread)

  const [filter, setFilter] = useState('all')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(new Set())

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  const params = { ...(filter !== 'all' ? { filter } : {}), ...(search ? { search } : {}) }
  const { data: notifications, isLoading } = useQuery({
    queryKey: ['notifications', filter, search],
    queryFn: async () => (await api.get('/api/notifications', { params })).data.data,
  })

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['notifications'] })
  useSocket({
    'notification:new': refresh,
    'notification:bulk_updated': refresh,
    'notification:archived': refresh,
    'notification:unarchived': refresh,
    'notification:deleted': refresh,
    'notification:bulk_deleted': refresh,
  })

  const markRead = async (n) => {
    if (n.is_read) return
    await api.put('/api/notifications/mark-read', { id: n.id })
    decrementUnread()
    refresh()
  }

  const markAllRead = async () => {
    await api.put('/api/notifications/mark-all-read')
    setUnreadCount(0)
    refresh()
  }

  const bulkAction = async (action) => {
    const ids = Array.from(selected)
    if (!ids.length) return
    await api.put('/api/notifications/bulk', { ids, action })
    setSelected(new Set())
    refresh()
  }

  const bulkDelete = async () => {
    const ids = Array.from(selected)
    if (!ids.length) return
    await api.delete('/api/notifications/bulk', { data: { ids } })
    setSelected(new Set())
    refresh()
  }

  const toggleSelected = (id) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const groups = useMemo(() => groupByDate(notifications || []), [notifications])

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

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <Input
            placeholder="Search notifications…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex rounded-lg border border-border p-0.5">
          {FILTER_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setFilter(t.key)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium',
                filter === t.key ? 'bg-primary-800 text-white' : 'text-text-secondary hover:bg-surface-hover'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        {selected.size > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5">
            <span className="text-xs text-text-muted">{selected.size} selected</span>
            <Button size="sm" variant="ghost" onClick={() => bulkAction('read')}>Mark read</Button>
            <Button size="sm" variant="ghost" onClick={() => bulkAction('archive')}>
              <Archive className="h-3.5 w-3.5" /> Archive
            </Button>
            <Button size="sm" variant="ghost" className="text-red-600" onClick={bulkDelete}>
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
          </div>
        )}
      </div>

      {isLoading ? (
        <CardSkeleton />
      ) : !notifications?.length ? (
        <EmptyState icon={Bell} title="No notifications yet" />
      ) : (
        <div className="space-y-6">
          {groups.map(([label, items]) => (
            <div key={label} className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{label}</p>
              <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-2">
                {items.map((n) => {
                  const Icon = resolveIcon(n.type)
                  const priority = resolvePriority(n)
                  const clickable = isClickable(n)
                  return (
                    <motion.div key={n.id} variants={staggerItem}>
                      <Card className={cn(!n.is_read && 'border-primary-200 bg-primary-50/40 dark:border-primary-800 dark:bg-primary-900/20')}>
                        <CardContent className="flex items-start gap-3 py-3">
                          <input
                            type="checkbox"
                            className="mt-1.5 shrink-0"
                            checked={selected.has(n.id)}
                            onChange={() => toggleSelected(n.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-hover text-text-secondary">
                            <Icon className="h-4 w-4" />
                          </div>
                          <div
                            className={cn('min-w-0 flex-1', clickable && 'cursor-pointer')}
                            onClick={() => {
                              markRead(n)
                              if (clickable) navigate(n.link)
                            }}
                          >
                            <div className="flex items-center gap-2">
                              <p className="truncate text-sm font-medium text-text-primary">{n.title}</p>
                              {priority !== 'normal' && <Badge variant={priority} className="capitalize">{priority}</Badge>}
                            </div>
                            {n.message && <p className="text-xs text-text-muted">{n.message}</p>}
                            <p className="mt-1 text-[11px] text-text-muted">{dayjs(n.created_at).fromNow()}</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            {!n.is_read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary-600" />}
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label="Archive"
                              onClick={async (e) => {
                                e.stopPropagation()
                                await api.put(`/api/notifications/${n.id}/archive`)
                                refresh()
                              }}
                            >
                              <Archive className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label="Delete"
                              className="text-red-600"
                              onClick={async (e) => {
                                e.stopPropagation()
                                await api.delete(`/api/notifications/${n.id}`)
                                refresh()
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )
                })}
              </motion.div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  )
}
