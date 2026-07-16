export const CATEGORIES = [
  { value: 'general', label: 'General' },
  { value: 'job_fair', label: 'Job Fair' },
  { value: 'training', label: 'Training' },
  { value: 'spes', label: 'SPES' },
  { value: 'owwa', label: 'OWWA' },
  { value: 'dilp', label: 'DILP' },
  { value: 'manpower_skills_training', label: 'Manpower Skills Training' },
  { value: 'system_update', label: 'System Update' },
  { value: 'others', label: 'Others' },
]

export const CATEGORY_LABELS = Object.fromEntries(CATEGORIES.map((c) => [c.value, c.label]))

export const PRIORITIES = [
  { value: 'normal', label: 'Normal' },
  { value: 'important', label: 'Important' },
  { value: 'urgent', label: 'Urgent' },
]

export const STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
  { value: 'archived', label: 'Archived' },
]
