// Mirrors backend/schemas/jobseeker_schemas.py — keep these two lists in sync.
export const GENDERS = ['Male', 'Female', 'Prefer not to say']
export const CIVIL_STATUSES = ['Single', 'Married', 'Widowed', 'Separated', 'Divorced']
export const EMPLOYMENT_STATUSES = ['Employed', 'Unemployed', 'Self-Employed', 'Student', 'OFW/Returning OFW']
export const EMPLOYMENT_TYPES = ['Full-time', 'Part-time', 'Contractual', 'Seasonal', 'Freelance']
export const ATTAINMENT_LEVELS = ['Elementary', 'High School', 'Senior High School', 'Vocational/TVET', 'College', 'Post-Graduate']

// Mirrors backend/models/jobseeker.py DOCUMENT_TYPE_LABELS / REQUIRED_DOCUMENT_TYPES.
export const DOCUMENT_TYPES = [
  { type: 'government_id', label: 'Valid Government ID', required: true, multiple: false },
  { type: 'id_photo_2x2', label: '2x2 ID Picture', required: false, multiple: false },
  { type: 'diploma', label: 'Diploma', required: false, multiple: false },
  { type: 'training_certificate', label: 'Training Certificate', required: false, multiple: true },
  { type: 'certificate_of_employment', label: 'Certificate of Employment', required: false, multiple: false },
]
