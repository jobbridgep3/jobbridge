// Reuses the exact same option vocabulary as the jobseeker profile editor so
// filter values always match what's actually stored on JobseekerProfile rows.
export { ATTAINMENT_LEVELS, EMPLOYMENT_STATUSES, GENDERS } from '../../jobseeker/profile-sections/options'

// Mirrors backend/models/vacancy.py::VACANCY_STATUSES.
export const VACANCY_STATUSES = ['draft', 'pending', 'approved', 'rejected', 'published', 'suspended', 'closed', 'filled']

export const PERIOD_OPTIONS = [
  { value: 'all', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'quarter', label: 'This Quarter' },
  { value: 'year', label: 'This Year' },
  { value: 'custom', label: 'Custom Range' },
]

// Mirrors backend/services/lmi_service.py::AGE_BRACKETS.
export const AGE_GROUPS = [
  { label: '15–24', min: 15, max: 24 },
  { label: '25–34', min: 25, max: 34 },
  { label: '35–44', min: 35, max: 44 },
  { label: '45–54', min: 45, max: 54 },
  { label: '55+', min: 55, max: null },
]

export const EMPTY_LMI_FILTERS = {
  period: 'all', date_from: '', date_to: '',
  barangay: '', municipality: '', employment_status: '', gender: '',
  age_min: '', age_max: '', educational_attainment: '', industry: '',
  occupation: '', job_category_id: '', employer_company_id: '', vacancy_status: '',
}

/** Strips empty values before sending as query params — the backend's
 * parse_lmi_filters() treats a missing key the same as an explicit "All". */
export function toLmiParams(filters) {
  return Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== '' && v !== null && v !== undefined))
}

export const LMI_CHART_COLORS = ['#1e3a8a', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#0ea5e9', '#0891b2', '#16a34a']
