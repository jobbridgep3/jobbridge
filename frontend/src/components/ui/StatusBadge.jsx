import { Badge } from './Badge'

const STATUS_MAP = {
  applied: { label: 'Applied', variant: 'default' },
  under_review: { label: 'Under Review', variant: 'info' },
  interview_scheduled: { label: 'Interview Scheduled', variant: 'warning' },
  hired: { label: 'Hired', variant: 'success' },
  rejected: { label: 'Rejected', variant: 'danger' },
  cancelled: { label: 'Cancelled', variant: 'default' },
  pending: { label: 'Pending', variant: 'warning' },
  active: { label: 'Active', variant: 'success' },
  closed: { label: 'Closed', variant: 'default' },
  terminated: { label: 'Terminated', variant: 'danger' },
  completed: { label: 'Completed', variant: 'success' },
  accepted: { label: 'Accepted', variant: 'success' },
  declined: { label: 'Declined', variant: 'danger' },
  verified: { label: 'Verified', variant: 'success' },
  unverified: { label: 'Unverified', variant: 'default' },
  suspended: { label: 'Suspended', variant: 'danger' },
  submitted: { label: 'Submitted', variant: 'info' },
  endorsed: { label: 'Endorsed', variant: 'warning' },
  for_release: { label: 'For Release', variant: 'warning' },
  approved: { label: 'Approved', variant: 'success' },
  enrolled: { label: 'Enrolled', variant: 'info' },
  waitlisted: { label: 'Waitlisted', variant: 'warning' },
  attended: { label: 'Attended', variant: 'success' },
  certificate_issued: { label: 'Certificate Issued', variant: 'success' },
}

export function StatusBadge({ status }) {
  const entry = STATUS_MAP[status] || { label: status?.replace(/_/g, ' ') || 'Unknown', variant: 'default' }
  return <Badge variant={entry.variant} className="capitalize">{entry.label}</Badge>
}
