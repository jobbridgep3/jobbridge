import { Navigate, Outlet } from 'react-router-dom'

import { useAuthStore } from '../store/authStore'

export function ProtectedRoute() {
  const token = useAuthStore((s) => s.token)

  if (!token) {
    // No redirect state attached here on purpose — carrying the pre-redirect
    // location through to the login page would let it leak into whichever
    // account subsequently logs in on this tab, sending them to the previous
    // session's page instead of their own dashboard. The one legitimate
    // "return to this page after login" flow (anonymous Apply Now/Register
    // CTAs) uses its own dedicated state key — see lib/publicCta.js.
    return <Navigate to="/login" replace />
  }
  return <Outlet />
}
