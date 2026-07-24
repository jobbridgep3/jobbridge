import {
  Briefcase, CalendarDays, ClipboardCheck, Compass, GraduationCap, HandCoins, Search, Send, Ship, Users,
} from 'lucide-react'

// Content lives here, separate from the page component, so it can be edited
// later without touching JSX. "program" entries mirror PESO Pila's official
// Citizen's Charter external services; "platform" entries are JobBridge
// features already built into the system.
export const SERVICES = [
  {
    icon: Search,
    title: 'Job Matching',
    category: 'platform',
    description:
      'Create a jobseeker profile and get matched with published vacancies from accredited employers based on your skills and experience.',
  },
  {
    icon: Send,
    title: 'Referral Services',
    category: 'platform',
    description:
      'Request a PESO referral letter for a specific vacancy or in general — PESO staff review and endorse qualified jobseekers directly to employers.',
  },
  {
    icon: CalendarDays,
    title: 'Job Fair',
    category: 'platform',
    description:
      'Join scheduled job fairs, pre-register, and connect with multiple hiring employers in person or online through employer booths.',
  },
  {
    icon: ClipboardCheck,
    title: 'Employment Monitoring',
    category: 'platform',
    description:
      'Once hired, your employment record is tracked from deployment to completion, so PESO can follow up and jobseekers can reapply once employment ends.',
  },
  {
    icon: Compass,
    title: 'Career Guidance',
    category: 'platform',
    description:
      'Get guidance on available programs, skills training, and livelihood opportunities suited to your goals and current situation.',
  },
  {
    icon: Users,
    title: 'Special/Local Recruitment Activity (SRA/LRA)',
    category: 'program',
    description:
      'Assistance in the conduct of special or local recruitment activities for local, overseas, and land-based employment — giving jobseekers access to multiple employment options at once.',
  },
  {
    icon: GraduationCap,
    title: 'Special Program for Employment of Students (SPES)',
    category: 'program',
    description:
      'Temporary employment for disadvantaged but deserving students and out-of-school youth (15–25 years old) to help augment family income while continuing their studies.',
  },
  {
    icon: Briefcase,
    title: 'Manpower Skills Training Program',
    category: 'program',
    description:
      'Referral of applicants to skills training programs that enhance employability and workplace productivity, in coordination with TESDA.',
  },
  {
    icon: HandCoins,
    title: 'DOLE Integrated Livelihood Program (DILP)',
    category: 'program',
    description:
      'Referral and assistance for disadvantaged and marginalized Pileños applying for livelihood assistance under DOLE’s integrated livelihood program.',
  },
  {
    icon: Ship,
    title: 'OWWA Assistance Program',
    category: 'program',
    description:
      'Assistance in applying for OWWA social and welfare programs for overseas Filipino workers (OFWs) and their immediate beneficiaries.',
  },
]
