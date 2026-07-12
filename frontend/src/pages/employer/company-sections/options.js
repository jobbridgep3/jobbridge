// Mirrors backend/models/employer.py enum tuples — keep these in sync.
export const BUSINESS_TYPES = [
  { value: 'corporation', label: 'Corporation' },
  { value: 'sole_proprietorship', label: 'Sole Proprietorship' },
  { value: 'cooperative', label: 'Cooperative' },
]

// business_type -> which registration-number field is shown alongside BIR TIN/Business Permit.
export const BUSINESS_TYPE_REGISTRATION_FIELD = {
  corporation: { field: 'sec_number', label: 'SEC Registration Number' },
  sole_proprietorship: { field: 'dti_number', label: 'DTI Registration Number' },
  cooperative: { field: 'cda_number', label: 'CDA Registration Number' },
}

export const COMPANY_SIZES = [
  { value: 'micro', label: 'Micro (1-9 employees)' },
  { value: 'small', label: 'Small (10-99 employees)' },
  { value: 'medium', label: 'Medium (100-199 employees)' },
  { value: 'large', label: 'Large (200+ employees)' },
]

export const HIRING_STATUSES = [
  { value: 'actively_hiring', label: 'Actively Hiring' },
  { value: 'not_hiring', label: 'Not Hiring' },
  { value: 'paused', label: 'Paused' },
]

export const WORK_SETUPS = [
  { value: 'onsite', label: 'Onsite' },
  { value: 'remote', label: 'Remote' },
  { value: 'hybrid', label: 'Hybrid' },
]

export const EMPLOYMENT_TYPES_OFFERED = [
  { value: 'full_time', label: 'Full-time' },
  { value: 'part_time', label: 'Part-time' },
  { value: 'contractual', label: 'Contractual' },
  { value: 'seasonal', label: 'Seasonal' },
  { value: 'internship', label: 'Internship' },
]

// Mirrors backend/models/employer.py COMPANY_DOCUMENT_TYPES / COMPANY_MANDATORY_DOCUMENT_TYPES.
// company_logo is uploaded via the dedicated logo picker in BasicInfoSection, not this list.
export const COMPANY_DOCUMENT_TYPES = [
  { type: 'business_permit', label: 'Business Permit', required: true },
  { type: 'business_registration_certificate', label: 'SEC / DTI / CDA Certificate', required: true },
  { type: 'bir_registration', label: 'BIR Registration', required: true },
  { type: 'philgeps', label: 'PhilGEPS Registration', required: false },
  { type: 'mayors_permit', label: "Mayor's Permit", required: false },
  { type: 'dole_registration', label: 'DOLE Registration', required: false },
  { type: 'peza_certificate', label: 'PEZA Certificate', required: false },
  { type: 'accreditation_certificate', label: 'Accreditation Certificate', required: false },
  { type: 'iso_certificate', label: 'ISO Certificate', required: false },
  { type: 'safety_certificate', label: 'Safety Certificate', required: false },
  { type: 'rep_gov_id', label: "Representative's Government ID", required: false },
  { type: 'authorization_letter', label: 'Authorization Letter', required: false },
  { type: 'company_id', label: 'Company ID', required: false },
]
