import {
  Award,
  Bell,
  Briefcase,
  Calendar,
  CalendarClock,
  CheckCircle2,
  FileText,
  Gift,
  GraduationCap,
  Handshake,
  MailWarning,
  MessageSquare,
  Megaphone,
  ShieldAlert,
  ShieldCheck,
  UserPlus,
  Users,
} from 'lucide-react'

/** Fallback priority per notification `type`, used only when the backend
 * row doesn't carry an explicit `priority` (true for every existing call
 * site except announcement-sourced notifications, which set their own). */
export const TYPE_PRIORITY_MAP = {
  interview_cancelled: 'urgent',
  vacancy_rejected: 'urgent',
  account_suspended: 'urgent',
  referral_rejected: 'urgent',
  interview_declined: 'important',
  interview_scheduled: 'important',
  interview_rescheduled: 'important',
  job_offer: 'important',
  document_request: 'important',
  offer_response: 'important',
  reschedule_request: 'important',
  vacancy_suspended: 'important',
  jobfair_cancelled: 'important',
  jobfair_booth_status: 'important',
  announcement_published: 'important',
}

export function resolvePriority(notification) {
  return notification.priority || TYPE_PRIORITY_MAP[notification.type] || 'normal'
}

/** Icon component per notification `type`, grouped logically. */
export const TYPE_ICON_MAP = {
  application_message: MessageSquare,
  document_request: FileText,
  job_offer: Gift,
  offer_response: Handshake,
  account_welcome: UserPlus,
  employment_updated: Briefcase,
  employment_created: Briefcase,
  interview_scheduled: Calendar,
  interview_rescheduled: CalendarClock,
  interview_cancelled: CalendarClock,
  interview_accepted: CheckCircle2,
  interview_declined: MailWarning,
  interview_result: FileText,
  reschedule_request: CalendarClock,
  reschedule_response: CalendarClock,
  jobfair_updated: Users,
  jobfair_booth_status: Users,
  jobfair_cancelled: Users,
  jobfair_booth_visit: Users,
  new_applicant: UserPlus,
  program_status: FileText,
  referral_ready: FileText,
  referral_rejected: MailWarning,
  account_verified: ShieldCheck,
  document_reviewed: FileText,
  hr_document_reviewed: FileText,
  account_suspended: ShieldAlert,
  vacancy_approved: Briefcase,
  vacancy_rejected: Briefcase,
  vacancy_suspended: Briefcase,
  vacancy_reactivated: Briefcase,
  vacancy_published: Briefcase,
  certificate_issued: Award,
  interview_reminder: CalendarClock,
  application_status: FileText,
  announcement_published: Megaphone,
  graduation: GraduationCap,
}

export function resolveIcon(type) {
  return TYPE_ICON_MAP[type] || Bell
}

/** A handful of existing notification types (account_verified, some
 * vacancy_* variants) are persisted with no `link` at all in some contexts
 * — the row's own `link` field is the authoritative signal either way, so
 * this just checks it directly rather than gating on `type`. */
export function isClickable(notification) {
  return Boolean(notification.link)
}
