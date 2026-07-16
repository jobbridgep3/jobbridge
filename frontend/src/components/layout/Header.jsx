import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { Bell, ChevronDown, LogOut, Settings, UserRound } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { Breadcrumb } from '../ui/Breadcrumb'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/DropdownMenu'
import { resolveIcon } from '../../config/notificationMeta'
import { ROLE_DASHBOARD } from '../../config/navigation'
import api from '../../lib/axios'
import { cn } from '../../lib/utils'
import { useAuthStore } from '../../store/authStore'
import { useUiStore } from '../../store/uiStore'

export function Header({ breadcrumbItems = [] }) {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const unreadCount = useUiStore((s) => s.unreadCount)
  const navigate = useNavigate()
  const basePath = ROLE_DASHBOARD[user?.role]?.split('/dashboard')[0]

  const { data: recent } = useQuery({
    queryKey: ['notifications', 'preview'],
    queryFn: async () => (await api.get('/api/notifications', { params: { limit: 5 } })).data.data,
    enabled: Boolean(user),
  })

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const initials = (user?.email || '?').slice(0, 2).toUpperCase()

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-surface/90 px-6 backdrop-blur">
      <Breadcrumb items={breadcrumbItems} />

      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger
            className="relative flex h-9 w-9 items-center justify-center rounded-full text-text-muted hover:bg-surface-hover"
            aria-label="Notifications"
          >
            <Bell className="h-[18px] w-[18px]" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-80">
            <p className="px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted">Notifications</p>
            {!recent?.length ? (
              <p className="px-2.5 py-3 text-sm text-text-muted">No notifications yet.</p>
            ) : (
              recent.map((n) => {
                const Icon = resolveIcon(n.type)
                return (
                  <DropdownMenuItem
                    key={n.id}
                    onClick={() => n.link && navigate(n.link)}
                    className={cn('items-start gap-2', !n.is_read && 'bg-primary-50/60 dark:bg-primary-900/20')}
                  >
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-text-secondary" />
                    <div className="min-w-0">
                      <p className="truncate text-sm text-text-primary">{n.title}</p>
                      <p className="text-[11px] text-text-muted">{dayjs(n.created_at).fromNow()}</p>
                    </div>
                  </DropdownMenuItem>
                )
              })
            )}
            <DropdownMenuSeparator className="my-1 h-px bg-border-subtle" />
            <DropdownMenuItem onClick={() => navigate(`${basePath}/notifications`)} className="justify-center text-primary-700 dark:text-primary-400">
              View all
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 hover:bg-surface-hover">
            {user?.profile_picture_url ? (
              <img src={user.profile_picture_url} alt="" className="h-8 w-8 rounded-full object-cover" />
            ) : (
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-800 text-xs font-semibold text-white">
                {initials}
              </span>
            )}
            <span className="hidden max-w-[140px] truncate text-sm font-medium text-text-secondary sm:inline">{user?.email}</span>
            <ChevronDown className="h-3.5 w-3.5 text-text-muted" />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => navigate(`${basePath}/profile`)}>
              <UserRound className="h-4 w-4" /> My Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate(`${basePath}/settings`)}>
              <Settings className="h-4 w-4" /> Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator className="my-1 h-px bg-border-subtle" />
            <DropdownMenuItem onClick={handleLogout} className="text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30">
              <LogOut className="h-4 w-4" /> Log Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
