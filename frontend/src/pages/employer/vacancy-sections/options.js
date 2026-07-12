// Mirrors backend/models/vacancy.py enum tuples.
export const EMPLOYMENT_TYPES = [
  { value: 'full_time', label: 'Full-time' },
  { value: 'part_time', label: 'Part-time' },
  { value: 'contractual', label: 'Contractual' },
  { value: 'seasonal', label: 'Seasonal' },
  { value: 'internship', label: 'Internship' },
]

export const WORK_ARRANGEMENTS = [
  { value: 'onsite', label: 'Onsite' },
  { value: 'remote', label: 'Remote' },
  { value: 'hybrid', label: 'Hybrid' },
]

export const EDUCATION_LEVELS = ['Elementary', 'High School', 'Senior High School', 'Vocational/TVET', 'College', 'Post-Graduate']

export const PREF_GENDERS = ['Male', 'Female', 'Any']
export const PREF_CIVIL_STATUSES = ['Single', 'Married', 'Widowed', 'Separated', 'Divorced', 'Any']

export const COMMON_LANGUAGES = ['English', 'Filipino', 'Tagalog', 'Cebuano', 'Ilocano', 'Bicolano', 'Waray', 'Hiligaynon']

export const BENEFITS_CHECKLIST = [
  'HMO', 'SSS', 'PhilHealth', 'Pag-IBIG', '13th Month Pay', 'Paid Leave', 'Life Insurance',
  'Performance Bonus', 'Free Meals', 'Transportation Allowance', 'Housing Allowance', 'Retirement Plan',
]

// Mirrors backend/models/jobseeker.py DOCUMENT_TYPES + "resume" (tracked separately there).
export const APPLICANT_DOCUMENT_TYPES = [
  { type: 'resume', label: 'Resume / CV' },
  { type: 'government_id', label: 'Valid Government ID' },
  { type: 'id_photo_2x2', label: '2x2 ID Picture' },
  { type: 'diploma', label: 'Diploma' },
  { type: 'training_certificate', label: 'Training Certificate' },
  { type: 'certificate_of_employment', label: 'Certificate of Employment' },
]
