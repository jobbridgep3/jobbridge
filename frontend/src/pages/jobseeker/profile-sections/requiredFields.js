// Mirrors backend/services/profile_completion_service.py REQUIRED_FIELDS — keep in
// sync. Each `check` mirrors the corresponding Python lambda's truthiness logic
// exactly, so this can recompute completion live (pre-save) with no network call,
// while the backend value (returned on every fetch/save) stays authoritative.

export const REQUIRED_FIELDS = [
  { key: 'full_name', section: 'personal', label: 'Full Name', check: (f) => Boolean(f.full_name) },
  { key: 'contact_number', section: 'personal', label: 'Contact Number', check: (f) => Boolean(f.contact_number) },
  { key: 'date_of_birth', section: 'personal', label: 'Date of Birth', check: (f) => Boolean(f.date_of_birth) },
  { key: 'gender', section: 'personal', label: 'Gender', check: (f) => Boolean(f.gender) },
  { key: 'civil_status', section: 'personal', label: 'Civil Status', check: (f) => Boolean(f.civil_status) },
  { key: 'nationality', section: 'personal', label: 'Nationality', check: (f) => Boolean(f.nationality) },
  { key: 'barangay', section: 'personal', label: 'Barangay', check: (f) => Boolean(f.barangay) },
  { key: 'municipality', section: 'personal', label: 'Municipality', check: (f) => Boolean(f.municipality) },
  { key: 'province', section: 'personal', label: 'Province', check: (f) => Boolean(f.province) },
  { key: 'resume_url', section: 'documents', label: 'Resume/CV Uploaded', check: (f) => Boolean(f.resume_url) },
  {
    key: 'government_id', section: 'documents', label: 'Valid Government ID',
    check: (f) => (f.documents || []).some((d) => d.document_type === 'government_id'),
  },
  { key: 'employment_status', section: 'employment', label: 'Employment Status', check: (f) => Boolean(f.employment_status) },
  { key: 'preferred_job_position', section: 'employment', label: 'Preferred Job Position', check: (f) => Boolean(f.preferred_job_position) },
  { key: 'preferred_industry', section: 'employment', label: 'Preferred Industry', check: (f) => Boolean(f.preferred_industry) },
  { key: 'preferred_work_location', section: 'employment', label: 'Preferred Work Location', check: (f) => Boolean(f.preferred_work_location) },
  { key: 'employment_type', section: 'employment', label: 'Employment Type Preferred', check: (f) => Boolean(f.employment_type) },
  {
    key: 'educations', section: 'education', label: 'At Least One Education Entry',
    check: (f) => (f.educations || []).some((e) => e.school && e.attainment_level),
  },
  { key: 'technical_skills', section: 'skills', label: 'Technical Skills', check: (f) => Boolean(f.technical_skills?.length) },
  { key: 'soft_skills', section: 'skills', label: 'Soft Skills', check: (f) => Boolean(f.soft_skills?.length) },
  // Intentionally excluded (optional, matches existing UI labeling):
  // expected_salary, work_experiences, languages_spoken, certifications.
]

export const SECTION_LABELS = {
  personal: 'Personal Information',
  documents: 'Documents',
  employment: 'Employment Information',
  education: 'Educational Background',
  skills: 'Skills',
}

export function computeCompletion(form) {
  const results = REQUIRED_FIELDS.map((rf) => ({ ...rf, ok: rf.check(form) }))
  const completedCount = results.filter((r) => r.ok).length
  const totalCount = results.length

  return {
    profileCompletion: totalCount ? Math.round((completedCount / totalCount) * 100) : 100,
    completedCount,
    totalCount,
    results,
    missingFields: results.filter((r) => !r.ok).map(({ key, section, label }) => ({ key, section, label })),
  }
}
