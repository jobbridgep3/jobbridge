import { Bell, ChevronDown, LogOut, Settings, UserRound } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { Breadcrumb } from '../ui/Breadcrumb'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/DropdownMenu'
import { ROLE_DASHBOARD } from '../../config/navigation'
import { useAuthStore } from '../../store/authStore'
import { useUiStore } from '../../store/uiStore'

export function Header({ breadcrumbItems = [] }) {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const unreadCount = useUiStore((s) => s.unreadCount)
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const initials = (user?.email || '?').slice(0, 2).toUpperCase()

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-6 backdrop-blur">
      <Breadcrumb items={breadcrumbItems} />

      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate(`${ROLE_DASHBOARD[user?.role]?.split('/dashboard')[0]}/notifications`)}
          className="relative flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
          aria-label="Notifications"
        >
          <Bell className="h-[18px] w-[18px]" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 hover:bg-slate-100">
            {user?.profile_picture_url ? (
              <img src={user.profile_picture_url} alt="" className="h-8 w-8 rounded-full object-cover" />
            ) : (
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-800 text-xs font-semibold text-white">
                {initials}
              </span>
            )}
            <span className="hidden max-w-[140px] truncate text-sm font-medium text-slate-700 sm:inline">{user?.email}</span>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => navigate(`${ROLE_DASHBOARD[user?.role]?.split('/dashboard')[0]}/profile`)}>
              <UserRound className="h-4 w-4" /> My Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate(`${ROLE_DASHBOARD[user?.role]?.split('/dashboard')[0]}/settings`)}>
              <Settings className="h-4 w-4" /> Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator className="my-1 h-px bg-slate-100" />
            <DropdownMenuItem onClick={handleLogout} className="text-red-600 hover:bg-red-50">
              <LogOut className="h-4 w-4" /> Log Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
