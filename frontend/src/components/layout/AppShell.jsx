import { motion } from 'framer-motion'
import { useEffect } from 'react'
import toast from 'react-hot-toast'
import { Outlet, useLocation } from 'react-router-dom'

import { NAV_BY_ROLE } from '../../config/navigation'
import { useSocket } from '../../hooks/useSocket'
import api from '../../lib/axios'
import { pageTransition } from '../../lib/motion'
import { useAuthStore } from '../../store/authStore'
import { useUiStore } from '../../store/uiStore'
import { ChatbotWidget } from '../ChatbotWidget'
import { Header } from './Header'
import { Sidebar } from './Sidebar'

function useBreadcrumbItems(role) {
  const location = useLocation()
  const items = NAV_BY_ROLE[role] || []
  const segments = location.pathname.split('/').filter(Boolean) // [role, module, ...rest]
  const basePath = `/${segments[0]}/${segments[1] || ''}`.replace(/\/$/, '')
  const match = items.find((item) => item.href === basePath)

  const crumbs = []
  if (match) crumbs.push({ label: match.label, href: match.href })
  if (segments.length > 2) crumbs.push({ label: 'Details' })
  return crumbs
}

export function AppShell() {
  const user = useAuthStore((s) => s.user)
  const setUnreadCount = useUiStore((s) => s.setUnreadCount)
  const incrementUnread = useUiStore((s) => s.incrementUnread)
  const location = useLocation()
  const breadcrumbItems = useBreadcrumbItems(user?.role)

  useSocket({
    'notification:new': () => {
      incrementUnread()
    },
    'application:status_update': (payload) =>
      toast.success(`Application status updated: ${payload.status_label || payload.new_status?.replace(/_/g, ' ')}`),
    'interview:scheduled': () => toast('New interview scheduled', { icon: '📅' }),
    'interview:rescheduled': () => toast('An interview was rescheduled', { icon: '📅' }),
    'interview:cancelled': () => toast('An interview was cancelled', { icon: '📅' }),
    'interview:reschedule_request': () => toast('New interview reschedule request', { icon: '🔁' }),
    'interview:reschedule_response': () => toast('Your reschedule request has a response', { icon: '🔁' }),
    'interview:result': () => toast('An interview result was recorded', { icon: '📝' }),
    'application:message': () => toast('New message received', { icon: '💬' }),
    'application:document_request': () => toast('Document request update', { icon: '📄' }),
    'offer:new': () => toast.success('You received a job offer!'),
    'offer:response': () => toast('A job offer has a response', { icon: '🤝' }),
    'vacancy:approved': () => toast.success('A vacancy was approved'),
    'vacancy:rejected': () => toast.error('A vacancy was returned for revision'),
    'vacancy:published': (payload) =>
      toast(`New Job Opportunity!\n${payload.title} at ${payload.company_name} has just been posted. Click to view and apply.`, { icon: '🆕', duration: 6000 }),
    'program:status_change': (payload) => toast(`${payload.type?.toUpperCase()} status: ${payload.new_status}`, { icon: '📋' }),
    'referral:ready': () => toast.success('Your referral letter is ready to download'),
    'announcement:new': (payload) => toast(`PESO Announcement: ${payload.title}`, { icon: '📢' }),
    'employment:updated': () => toast('Employment record updated', { icon: '💼' }),
    'certificate:issued': () => toast.success('Your certificate has been issued'),
  })

  useEffect(() => {
    if (!user) return
    api
      .get('/api/notifications')
      .then((res) => setUnreadCount(res.data.data.filter((n) => !n.is_read).length))
      .catch(() => {})
  }, [user, setUnreadCount])

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar role={user?.role} />
      <div className="flex min-h-screen flex-1 flex-col">
        <Header breadcrumbItems={breadcrumbItems} />
        <motion.main key={location.pathname} {...pageTransition} className="flex-1 p-6">
          <Outlet />
        </motion.main>
      </div>
      {user?.role === 'jobseeker' && <ChatbotWidget />}
    </div>
  )
}
