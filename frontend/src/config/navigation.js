import {
  Award,
  Bell,
  Briefcase,
  Building2,
  CalendarCheck,
  ClipboardList,
  FileBarChart,
  FileCheck2,
  FileText,
  GraduationCap,
  HandCoins,
  Handshake,
  LayoutDashboard,
  MapPinned,
  Megaphone,
  Plane,
  Search,
  Send,
  Settings,
  Shield,
  ShieldCheck,
  UserCog,
  Users,
} from 'lucide-react'

export const JOBSEEKER_NAV = [
  { label: 'Dashboard', href: '/jobseeker/dashboard', icon: LayoutDashboard },
  { label: 'My Profile', href: '/jobseeker/profile', icon: Users },
  { label: 'Job Search', href: '/jobseeker/jobs', icon: Search },
  { label: 'My Applications', href: '/jobseeker/applications', icon: ClipboardList },
  { label: 'Employment Monitoring', href: '/jobseeker/employment', icon: Briefcase },
  { label: 'Interview Schedule', href: '/jobseeker/interviews', icon: CalendarCheck },
  { label: 'Job Fair', href: '/jobseeker/jobfair', icon: MapPinned },
  { label: 'SPES', href: '/jobseeker/spes', icon: GraduationCap },
  { label: 'Manpower Skills Training', href: '/jobseeker/training', icon: Award },
  { label: 'DILP', href: '/jobseeker/dilp', icon: HandCoins },
  { label: 'OWWA', href: '/jobseeker/owwa', icon: Plane },
  { label: 'Notifications', href: '/jobseeker/notifications', icon: Bell },
  { label: 'Settings', href: '/jobseeker/settings', icon: Settings },
]

export const EMPLOYER_NAV = [
  { label: 'Dashboard', href: '/employer/dashboard', icon: LayoutDashboard },
  { label: 'My Profile', href: '/employer/profile', icon: Users },
  { label: 'Company Profile', href: '/employer/company', icon: Building2 },
  { label: 'Vacancy Management', href: '/employer/vacancies', icon: Briefcase },
  { label: 'Applicant Management', href: '/employer/applicants', icon: ClipboardList },
  { label: 'Referral Management', href: '/employer/referrals', icon: Send },
  { label: 'Interview Management', href: '/employer/interviews', icon: CalendarCheck },
  { label: 'Job Fair', href: '/employer/jobfair', icon: MapPinned },
  { label: 'Employment Monitoring', href: '/employer/employment', icon: FileCheck2 },
  { label: 'Notifications', href: '/employer/notifications', icon: Bell },
  { label: 'Settings', href: '/employer/settings', icon: Settings },
]

export const STAFF_NAV = [
  { label: 'Dashboard', href: '/staff/dashboard', icon: LayoutDashboard },
  { label: 'Jobseeker Management', href: '/staff/jobseekers', icon: Users },
  { label: 'Employer Management', href: '/staff/employers', icon: Building2 },
  { label: 'Job Vacancy Management', href: '/staff/vacancies', icon: Briefcase },
  { label: 'Interview Oversight', href: '/staff/interviews', icon: CalendarCheck },
  { label: 'Referral Letters', href: '/staff/referrals', icon: FileText },
  { label: 'Employment Monitoring', href: '/staff/employment', icon: FileCheck2 },
  { label: 'Job Fair Management', href: '/staff/jobfair', icon: MapPinned },
  { label: 'ManPower Skills Management', href: '/staff/training', icon: Award },
  { label: 'DILP Management', href: '/staff/dilp', icon: HandCoins },
  { label: 'OWWA Management', href: '/staff/owwa', icon: Plane },
  { label: 'SPES Management', href: '/staff/spes', icon: GraduationCap },
  { label: 'LMI Reports', href: '/staff/lmi', icon: FileBarChart },
  { label: 'Announcements', href: '/staff/announcements', icon: Megaphone },
  { label: 'Notifications', href: '/staff/notifications', icon: Bell },
  { label: 'Settings', href: '/staff/settings', icon: Settings },
]

export const ADMIN_NAV = [
  { label: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
  { label: 'Jobseeker Management', href: '/admin/jobseekers', icon: Users },
  { label: 'Employer Management', href: '/admin/employers', icon: Building2 },
  { label: 'Staff Management', href: '/admin/staff', icon: UserCog },
  { label: 'Job Vacancy Management', href: '/admin/vacancies', icon: Briefcase },
  { label: 'Interview Oversight', href: '/admin/interviews', icon: CalendarCheck },
  { label: 'Referral Letters', href: '/admin/referrals', icon: FileText },
  { label: 'Employment Monitoring', href: '/admin/employment', icon: FileCheck2 },
  { label: 'Job Fair Management', href: '/admin/jobfair', icon: MapPinned },
  { label: 'ManPower Skills Management', href: '/admin/training', icon: Award },
  { label: 'DILP Management', href: '/admin/dilp', icon: HandCoins },
  { label: 'OWWA Management', href: '/admin/owwa', icon: Plane },
  { label: 'SPES Management', href: '/admin/spes', icon: GraduationCap },
  { label: 'LMI Reports', href: '/admin/lmi', icon: FileBarChart },
  { label: 'Announcements', href: '/admin/announcements', icon: Megaphone },
  { label: 'Audit Trail', href: '/admin/audit', icon: ShieldCheck },
  { label: 'Notifications', href: '/admin/notifications', icon: Bell },
  { label: 'Settings', href: '/admin/settings', icon: Settings },
]

export const NAV_BY_ROLE = {
  jobseeker: JOBSEEKER_NAV,
  employer: EMPLOYER_NAV,
  staff: STAFF_NAV,
  admin: ADMIN_NAV,
}

export const ROLE_LABELS = {
  jobseeker: 'Jobseeker',
  employer: 'Employer',
  staff: 'PESO Staff',
  admin: 'Administrator',
}

export const ROLE_ICONS = {
  jobseeker: Users,
  employer: Handshake,
  staff: Shield,
  admin: ShieldCheck,
}

export const ROLE_DASHBOARD = {
  jobseeker: '/jobseeker/dashboard',
  employer: '/employer/dashboard',
  staff: '/staff/dashboard',
  admin: '/admin/dashboard',
}

export { FileText }
