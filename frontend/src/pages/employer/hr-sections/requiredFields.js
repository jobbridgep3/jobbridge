// Mirrors backend/services/profile_completion_service.py HR_REQUIRED_FIELDS — keep in sync.

function hasDocType(f, type) {
  return (f.documents || []).some((d) => d.document_type === type)
}

export const REQUIRED_FIELDS = [
  { key: 'full_name', section: 'personal', label: 'Full Name', check: (f) => Boolean(f.full_name) },
  { key: 'gender', section: 'personal', label: 'Gender', check: (f) => Boolean(f.gender) },
  { key: 'date_of_birth', section: 'personal', label: 'Birthday', check: (f) => Boolean(f.date_of_birth) },
  { key: 'civil_status', section: 'personal', label: 'Civil Status', check: (f) => Boolean(f.civil_status) },
  { key: 'nationality', section: 'personal', label: 'Nationality', check: (f) => Boolean(f.nationality) },
  { key: 'personal_email', section: 'contact', label: 'Personal Email', check: (f) => Boolean(f.personal_email) },
  { key: 'mobile_number', section: 'contact', label: 'Mobile Number', check: (f) => Boolean(f.mobile_number) },
  { key: 'employee_id', section: 'employment', label: 'Employee ID', check: (f) => Boolean(f.employee_id) },
  { key: 'department', section: 'employment', label: 'Department', check: (f) => Boolean(f.department) },
  { key: 'position', section: 'employment', label: 'Position', check: (f) => Boolean(f.position) },
  { key: 'employment_status', section: 'employment', label: 'Employment Status', check: (f) => Boolean(f.employment_status) },
  { key: 'hr_role', section: 'employment', label: 'HR Role', check: (f) => Boolean(f.hr_role) },
  { key: 'region_code', section: 'address', label: 'Region', check: (f) => Boolean(f.region_code) },
  { key: 'province_code', section: 'address', label: 'Province', check: (f) => Boolean(f.province_code) },
  { key: 'city_municipality_code', section: 'address', label: 'City / Municipality', check: (f) => Boolean(f.city_municipality_code) },
  { key: 'barangay_code', section: 'address', label: 'Barangay', check: (f) => Boolean(f.barangay_code) },
  { key: 'street_address', section: 'address', label: 'Street Address', check: (f) => Boolean(f.street_address) },
  { key: 'government_id', section: 'documents', label: 'Government ID', check: (f) => hasDocType(f, 'government_id') },
  { key: 'company_id', section: 'documents', label: 'Company ID', check: (f) => hasDocType(f, 'company_id') },
  { key: 'authorization_letter', section: 'documents', label: 'Authorization Letter', check: (f) => hasDocType(f, 'authorization_letter') },
]

export const SECTION_LABELS = {
  personal: 'Personal',
  contact: 'Contact',
  employment: 'Employment',
  address: 'Address',
  documents: 'Documents',
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
