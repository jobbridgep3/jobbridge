import { motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'

import { AnnouncementContent } from '../../components/announcements/AnnouncementContent'
import { ROLE_DASHBOARD } from '../../config/navigation'
import { fadeIn } from '../../lib/motion'
import { useAuthStore } from '../../store/authStore'

export default function AnnouncementDetails() {
  const { id } = useParams()
  const user = useAuthStore((s) => s.user)
  const backTo = user ? ROLE_DASHBOARD[user.role] || '/' : '/'

  return (
    <motion.div {...fadeIn} className="mx-auto max-w-3xl space-y-6 p-6">
      <Link to={backTo} className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-primary-700">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      <AnnouncementContent id={id} />
    </motion.div>
  )
}
