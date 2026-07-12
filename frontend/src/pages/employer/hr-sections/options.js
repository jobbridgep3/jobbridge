// Mirrors backend/models/employer_hr.py enum tuples / backend/schemas/employer_schemas.py GENDERS.
export const GENDERS = ['Male', 'Female', 'Prefer not to say']
export const CIVIL_STATUSES = ['Single', 'Married', 'Widowed', 'Separated', 'Divorced']

export const EMPLOYMENT_STATUSES = [
  { value: 'regular', label: 'Regular' },
  { value: 'probationary', label: 'Probationary' },
  { value: 'contractual', label: 'Contractual' },
  { value: 'part_time', label: 'Part-time' },
]

export const HR_ROLES = [
  { value: 'hr_officer', label: 'HR Officer' },
  { value: 'hr_manager', label: 'HR Manager' },
  { value: 'recruiter', label: 'Recruiter' },
  { value: 'owner', label: 'Owner' },
  { value: 'admin_staff', label: 'Admin Staff' },
]

// Mirrors backend/models/employer_hr.py HR_DOCUMENT_TYPES / HR_MANDATORY_DOCUMENT_TYPES.
export const HR_DOCUMENT_TYPES = [
  { type: 'government_id', label: 'Government ID', required: true },
  { type: 'company_id', label: 'Company ID', required: true },
  { type: 'authorization_letter', label: 'Authorization Letter', required: true },
  { type: 'prc_license', label: 'PRC License', required: false },
  { type: 'hr_certificate', label: 'HR Certificate', required: false },
  { type: 'digital_signature', label: 'Digital Signature', required: false },
]
