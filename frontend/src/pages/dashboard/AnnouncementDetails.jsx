import { motion } from 'framer-motion'
import { ArrowLeft, LayoutDashboard } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'

import { AnnouncementContent } from '../../components/announcements/AnnouncementContent'
import { Button } from '../../components/ui/Button'
import { ROLE_DASHBOARD } from '../../config/navigation'
import { fadeIn } from '../../lib/motion'
import { useAuthStore } from '../../store/authStore'

/** Minimal, layout-free wrapper around AnnouncementContent for authenticated
 * users opening an announcement from their dashboard/notifications. Deliberately
 * skips PublicLayout (navbar + public login/register CTAs) and AppShell
 * (sidebar) so a logged-in user can't wander into the public auth flow and
 * bleed into a different session — see the public version at
 * pages/public/AnnouncementDetails.jsx for the marketing-site equivalent. */
export default function DashboardAnnouncementDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const dashboardPath = ROLE_DASHBOARD[user?.role] || '/'

  return (
    <div className="min-h-screen bg-surface-secondary">
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-surface/90 px-4 backdrop-blur sm:px-6">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Button variant="secondary" size="sm" onClick={() => navigate(dashboardPath)}>
          <LayoutDashboard className="h-4 w-4" /> Go to Dashboard
        </Button>
      </header>

      <motion.div {...fadeIn} className="mx-auto max-w-3xl p-6">
        <AnnouncementContent id={id} basePath="/dashboard/announcements" />
      </motion.div>
    </div>
  )
}
