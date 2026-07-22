/** Shared "continue as jobseeker" redirect used by every public Apply Now/Register
 * CTA (homepage panels, public job/job-fair detail pages). `targetPath` is the
 * existing authenticated jobseeker route that already has the real apply/register
 * UI and business logic (e.g. `/jobseeker/jobs/:id`) — anonymous visitors go
 * through /login first and land back there via ProtectedRoute's `state.from`
 * convention (see routes/ProtectedRoute.jsx + pages/public/Login.jsx). */
export function resolveJobseekerCta({ token, role, targetPath }) {
  if (!token) return { type: 'login', to: '/login', state: { from: { pathname: targetPath } } }
  if (role === 'jobseeker') return { type: 'continue', to: targetPath }
  return null
}
