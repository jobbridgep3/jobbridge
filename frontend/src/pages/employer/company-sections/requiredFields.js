// Mirrors backend/services/profile_completion_service.py COMPANY_REQUIRED_FIELDS —
// keep in sync. See jobseeker/profile-sections/requiredFields.js for the convention
// this follows (live pre-save recalculation, no network round-trip).

function registrationNumberOk(f) {
  const field = { corporation: 'sec_number', sole_proprietorship: 'dti_number', cooperative: 'cda_number' }[f.business_type]
  return field ? Boolean(f[field]) : false
}

function hasDocType(f, type) {
  return (f.documents || []).some((d) => d.document_type === type)
}

export const REQUIRED_FIELDS = [
  { key: 'company_name', section: 'basic', label: 'Company Name', check: (f) => Boolean(f.company_name) },
  { key: 'business_type', section: 'basic', label: 'Business Type', check: (f) => Boolean(f.business_type) },
  { key: 'industry', section: 'basic', label: 'Industry', check: (f) => Boolean(f.industry) },
  { key: 'description', section: 'basic', label: 'About Company', check: (f) => Boolean(f.description) },
  { key: 'company_email', section: 'basic', label: 'Company Email', check: (f) => Boolean(f.company_email) },
  { key: 'contact_number', section: 'basic', label: 'Contact Number', check: (f) => Boolean(f.contact_number) },
  { key: 'year_established', section: 'basic', label: 'Year Established', check: (f) => Boolean(f.year_established) },
  { key: 'num_employees', section: 'basic', label: 'Number of Employees', check: (f) => Boolean(f.num_employees) },
  { key: 'company_size', section: 'basic', label: 'Company Size', check: (f) => Boolean(f.company_size) },
  { key: 'region_code', section: 'address', label: 'Region', check: (f) => Boolean(f.region_code) },
  { key: 'province_code', section: 'address', label: 'Province', check: (f) => Boolean(f.province_code) },
  { key: 'city_municipality_code', section: 'address', label: 'City / Municipality', check: (f) => Boolean(f.city_municipality_code) },
  { key: 'barangay_code', section: 'address', label: 'Barangay', check: (f) => Boolean(f.barangay_code) },
  { key: 'street_address', section: 'address', label: 'Street Address', check: (f) => Boolean(f.street_address) },
  { key: 'business_permit_no', section: 'business_registration', label: 'Business Permit Number', check: (f) => Boolean(f.business_permit_no) },
  { key: 'bir_tin', section: 'business_registration', label: 'BIR TIN', check: (f) => Boolean(f.bir_tin) },
  { key: 'registration_number', section: 'business_registration', label: 'SEC/DTI/CDA Number', check: registrationNumberOk },
  { key: 'rep_name', section: 'representative', label: 'Representative Name', check: (f) => Boolean(f.rep_name) },
  { key: 'rep_position', section: 'representative', label: 'Representative Position', check: (f) => Boolean(f.rep_position) },
  { key: 'rep_email', section: 'representative', label: 'Representative Email', check: (f) => Boolean(f.rep_email) },
  { key: 'rep_contact_number', section: 'representative', label: 'Representative Contact Number', check: (f) => Boolean(f.rep_contact_number) },
  { key: 'hiring_status', section: 'employment', label: 'Hiring Status', check: (f) => Boolean(f.hiring_status) },
  { key: 'work_setup', section: 'employment', label: 'Work Setup', check: (f) => Boolean(f.work_setup?.length) },
  { key: 'employment_types_offered', section: 'employment', label: 'Employment Types Offered', check: (f) => Boolean(f.employment_types_offered?.length) },
  { key: 'business_permit', section: 'documents', label: 'Business Permit', check: (f) => hasDocType(f, 'business_permit') },
  { key: 'business_registration_certificate', section: 'documents', label: 'SEC/DTI/CDA Certificate', check: (f) => hasDocType(f, 'business_registration_certificate') },
  { key: 'bir_registration', section: 'documents', label: 'BIR Registration', check: (f) => hasDocType(f, 'bir_registration') },
  { key: 'company_logo', section: 'documents', label: 'Company Logo', check: (f) => hasDocType(f, 'company_logo') },
]

export const SECTION_LABELS = {
  basic: 'Basic Information',
  address: 'Company Address',
  business_registration: 'Business Registration',
  representative: 'Company Representative',
  employment: 'Employment Information',
  documents: 'Required Documents',
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
