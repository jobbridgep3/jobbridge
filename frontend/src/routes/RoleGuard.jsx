import { Navigate, Outlet } from 'react-router-dom'

import { ROLE_DASHBOARD } from '../config/navigation'
import { useAuthStore } from '../store/authStore'

export function RoleGuard({ allowedRole }) {
  const user = useAuthStore((s) => s.user)

  if (!user) return <Navigate to="/login" replace />
  if (user.role !== allowedRole) {
    return <Navigate to={ROLE_DASHBOARD[user.role] || '/login'} replace />
  }
  return <Outlet />
}
