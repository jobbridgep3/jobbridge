/** Formats a min/max salary range for display, honoring the "Hide Salary" toggle.
 * Pure/no side effects — used by both the vacancy form's live preview and the
 * public job listing/detail pages. */
export function formatSalaryRange(salaryMin, salaryMax, hideSalary) {
  if (hideSalary) return 'Salary not disclosed'
  const min = salaryMin != null && salaryMin !== '' ? Number(salaryMin) : null
  const max = salaryMax != null && salaryMax !== '' ? Number(salaryMax) : null
  if (min == null && max == null) return 'Negotiable'

  const fmt = (n) => `₱${n.toLocaleString('en-PH', { maximumFractionDigits: 0 })}`
  if (min != null && max != null) {
    if (min === max) return fmt(min)
    return `${fmt(min)} – ${fmt(max)}`
  }
  return fmt(min ?? max)
}
