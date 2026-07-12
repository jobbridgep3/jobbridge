// Mirrors backend/services/vacancy_state_service.py TRANSITIONS — used only to
// decide which action buttons to render; the backend re-validates every
// transition regardless of what the UI shows.
const TRANSITIONS = {
  'draft->pending': 'employer',
  'rejected->pending': 'employer',
  'pending->approved': 'staff',
  'pending->rejected': 'staff',
  'approved->published': 'employer_or_staff',
  'approved->suspended': 'staff',
  'published->closed': 'employer_or_staff',
  'published->filled': 'employer_or_staff',
  'published->suspended': 'staff',
  'closed->published': 'employer',
  'suspended->published': 'admin',
}

export function canTransition(currentStatus, newStatus, actorRole) {
  const allowedActor = TRANSITIONS[`${currentStatus}->${newStatus}`]
  if (!allowedActor) return false
  if (allowedActor === 'employer_or_staff') return ['employer', 'staff', 'admin'].includes(actorRole)
  if (allowedActor === 'staff') return ['staff', 'admin'].includes(actorRole)
  if (allowedActor === 'admin') return actorRole === 'admin'
  return actorRole === allowedActor
}

export const STATUS_LABELS = {
  draft: 'Draft',
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  published: 'Published',
  suspended: 'Suspended',
  closed: 'Closed',
  filled: 'Filled',
}
