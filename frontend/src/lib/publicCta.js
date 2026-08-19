/** Shared "continue as jobseeker" redirect used by every public Apply Now/Register
 * CTA (homepage panels, public job/job-fair detail pages). `targetPath` is the
 * existing authenticated jobseeker route that already has the real apply/register
 * UI and business logic (e.g. `/jobseeker/jobs/:id`) — anonymous visitors go
 * through /login first and land back there via the `ctaTarget` state key (see
 * pages/public/Login.jsx). Deliberately its own dedicated key, distinct from any
 * auth-guard redirect state, so a stale route from an unrelated login/logout
 * cycle can never be mistaken for an intentional "return to this page" request. */
export function resolveJobseekerCta({ token, role, targetPath }) {
  if (!token) return { type: 'login', to: '/login', state: { ctaTarget: targetPath } }
  if (role === 'jobseeker') return { type: 'continue', to: targetPath }
  return null
}
