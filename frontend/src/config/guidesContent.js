import { Briefcase, Building2, CalendarDays, CheckCircle, ClipboardList, FileText, Search, Send, ShieldCheck, UserPlus, Users } from 'lucide-react'

export const JOBSEEKER_GUIDE_STEPS = [
  {
    step: 1,
    icon: UserPlus,
    title: 'Create Your Account',
    description: 'Register as a Jobseeker and verify your email with the one-time code sent to you.',
  },
  {
    step: 2,
    icon: FileText,
    title: 'Complete Your Profile',
    description: 'Add your resume, skills, and work history so employers and PESO staff can properly assess your qualifications.',
  },
  {
    step: 3,
    icon: Search,
    title: 'Search & Apply for Jobs',
    description: 'Browse published vacancies, check your match score, and apply directly to the ones that fit you.',
  },
  {
    step: 4,
    icon: Send,
    title: 'Request a PESO Referral (Optional)',
    description: 'Ask PESO staff to review and endorse your application for a specific vacancy or in general.',
  },
  {
    step: 5,
    icon: ClipboardList,
    title: 'Track Your Applications',
    description: 'Follow your application status from submitted to hired, right from your dashboard.',
  },
  {
    step: 6,
    icon: CheckCircle,
    title: 'Attend Interviews & Get Hired',
    description: 'Respond to interview invitations and offers directly through JobBridge — no extra paperwork needed.',
  },
]

export const EMPLOYER_GUIDE_STEPS = [
  {
    step: 1,
    icon: Building2,
    title: 'Register Your Company',
    description: 'Sign up as an Employer and provide your company details and accreditation documents.',
  },
  {
    step: 2,
    icon: ShieldCheck,
    title: 'Get Verified by PESO',
    description: 'PESO staff review your submitted documents before your account is fully activated for posting vacancies.',
  },
  {
    step: 3,
    icon: Briefcase,
    title: 'Post Job Vacancies',
    description: 'Create job postings with the roles, qualifications, and number of slots you need to fill.',
  },
  {
    step: 4,
    icon: Users,
    title: 'Review Applicants & Referrals',
    description: 'Review direct applicants and PESO-referred candidates in one applicant pipeline.',
  },
  {
    step: 5,
    icon: CalendarDays,
    title: 'Schedule Interviews',
    description: 'Move qualified applicants through your hiring pipeline — shortlist, interview, and extend offers.',
  },
  {
    step: 6,
    icon: CheckCircle,
    title: 'Hire & Manage Employment Records',
    description: 'Once hired, employment is tracked in the system, keeping your records organized from deployment onward.',
  },
]
