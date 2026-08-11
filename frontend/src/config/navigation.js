import {
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
  Layers,
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

/** Flattens a mixed array of leaf items ({label,href,icon}) and group entries
 * ({label,icon,items:[...]}) into a plain array of leaf items. One level of
 * nesting only — groups cannot contain sub-groups. */
function flattenNavItems(entries) {
  return entries.flatMap((entry) => (entry.items ? entry.items : [entry]))
}

export const JOBSEEKER_NAV_GROUPS = [
  { label: 'Dashboard', href: '/jobseeker/dashboard', icon: LayoutDashboard },
  {
    label: 'My Account',
    icon: Users,
    items: [{ label: 'My Profile', href: '/jobseeker/profile', icon: Users }],
  },
  {
    label: 'Job Search',
    icon: Search,
    items: [
      { label: 'Job Search', href: '/jobseeker/jobs', icon: Search },
      { label: 'My Applications', href: '/jobseeker/applications', icon: ClipboardList },
      { label: 'Interview Schedule', href: '/jobseeker/interviews', icon: CalendarCheck },
    ],
  },
  {
    label: 'Employment Services',
    icon: Briefcase,
    items: [{ label: 'Employment Monitoring', href: '/jobseeker/employment', icon: Briefcase }],
  },
  {
    label: 'Programs',
    icon: Layers,
    items: [
      { label: 'Job Fair', href: '/jobseeker/jobfair', icon: MapPinned },
      { label: 'SPES', href: '/jobseeker/spes', icon: GraduationCap },
      { label: 'DILP', href: '/jobseeker/dilp', icon: HandCoins },
      { label: 'OWWA', href: '/jobseeker/owwa', icon: Plane },
      { label: 'ManPower Skills Management', href: '/jobseeker/training-referral', icon: Send },
    ],
  },
  {
    label: 'Communications',
    icon: Bell,
    items: [{ label: 'Notifications', href: '/jobseeker/notifications', icon: Bell }],
  },
  {
    label: 'System',
    icon: Settings,
    items: [{ label: 'Settings', href: '/jobseeker/settings', icon: Settings }],
  },
]

export const JOBSEEKER_NAV = flattenNavItems(JOBSEEKER_NAV_GROUPS)

export const EMPLOYER_NAV_GROUPS = [
  { label: 'Dashboard', href: '/employer/dashboard', icon: LayoutDashboard },
  {
    label: 'Company',
    icon: Building2,
    items: [
      { label: 'My Profile', href: '/employer/profile', icon: Users },
      { label: 'Company Profile', href: '/employer/company', icon: Building2 },
    ],
  },
  {
    label: 'Recruitment Services',
    icon: Briefcase,
    items: [
      { label: 'Vacancy Management', href: '/employer/vacancies', icon: Briefcase },
      { label: 'Applicant Management', href: '/employer/applicants', icon: ClipboardList },
      { label: 'Referral Management', href: '/employer/referrals', icon: Send },
      { label: 'Interview Management', href: '/employer/interviews', icon: CalendarCheck },
    ],
  },
  {
    label: 'Employment Services',
    icon: FileCheck2,
    items: [{ label: 'Employment Monitoring', href: '/employer/employment', icon: FileCheck2 }],
  },
  {
    label: 'Programs',
    icon: Layers,
    items: [{ label: 'Job Fair', href: '/employer/jobfair', icon: MapPinned }],
  },
  {
    label: 'Communications',
    icon: Bell,
    items: [{ label: 'Notifications', href: '/employer/notifications', icon: Bell }],
  },
  {
    label: 'System',
    icon: Settings,
    items: [{ label: 'Settings', href: '/employer/settings', icon: Settings }],
  },
]

export const EMPLOYER_NAV = flattenNavItems(EMPLOYER_NAV_GROUPS)

export const STAFF_NAV_GROUPS = [
  { label: 'Dashboard', href: '/staff/dashboard', icon: LayoutDashboard },
  {
    label: 'User Management',
    icon: Users,
    items: [
      { label: 'Jobseeker Management', href: '/staff/jobseekers', icon: Users },
      { label: 'Employer Management', href: '/staff/employers', icon: Building2 },
    ],
  },
  {
    label: 'Recruitment Services',
    icon: Briefcase,
    items: [
      { label: 'Job Vacancy Management', href: '/staff/vacancies', icon: Briefcase },
      { label: 'Interview Oversight', href: '/staff/interviews', icon: CalendarCheck },
      { label: 'Referral Letters', href: '/staff/referrals', icon: FileText },
    ],
  },
  {
    label: 'Employment Services',
    icon: FileCheck2,
    items: [{ label: 'Employment Monitoring', href: '/staff/employment', icon: FileCheck2 }],
  },
  {
    label: 'Programs',
    icon: Layers,
    items: [
      { label: 'Job Fair Management', href: '/staff/jobfair', icon: MapPinned },
      { label: 'SPES Management', href: '/staff/spes', icon: GraduationCap },
      { label: 'DILP Management', href: '/staff/dilp', icon: HandCoins },
      { label: 'OWWA Management', href: '/staff/owwa', icon: Plane },
      { label: 'ManPower Skills Management', href: '/staff/training-referral/queue', icon: Send },
    ],
  },
  {
    label: 'Reports & Analytics',
    icon: FileBarChart,
    items: [{ label: 'LMI Reports', href: '/staff/lmi', icon: FileBarChart }],
  },
  {
    label: 'Communications',
    icon: Megaphone,
    items: [
      { label: 'Announcements', href: '/staff/announcements', icon: Megaphone },
      { label: 'Notifications', href: '/staff/notifications', icon: Bell },
    ],
  },
  {
    label: 'System',
    icon: Settings,
    items: [{ label: 'Settings', href: '/staff/settings', icon: Settings }],
  },
]

export const STAFF_NAV = flattenNavItems(STAFF_NAV_GROUPS)

export const ADMIN_NAV_GROUPS = [
  { label: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
  {
    label: 'User Management',
    icon: Users,
    items: [
      { label: 'Jobseeker Management', href: '/admin/jobseekers', icon: Users },
      { label: 'Employer Management', href: '/admin/employers', icon: Building2 },
      { label: 'Staff Management', href: '/admin/staff', icon: UserCog },
    ],
  },
  {
    label: 'Recruitment Services',
    icon: Briefcase,
    items: [
      { label: 'Job Vacancy Management', href: '/admin/vacancies', icon: Briefcase },
      { label: 'Interview Oversight', href: '/admin/interviews', icon: CalendarCheck },
      { label: 'Referral Letters', href: '/admin/referrals', icon: FileText },
    ],
  },
  {
    label: 'Employment Services',
    icon: FileCheck2,
    items: [{ label: 'Employment Monitoring', href: '/admin/employment', icon: FileCheck2 }],
  },
  {
    label: 'Programs',
    icon: Layers,
    items: [
      { label: 'Job Fair Management', href: '/admin/jobfair', icon: MapPinned },
      { label: 'SPES Management', href: '/admin/spes', icon: GraduationCap },
      { label: 'DILP Management', href: '/admin/dilp', icon: HandCoins },
      { label: 'OWWA Management', href: '/admin/owwa', icon: Plane },
      { label: 'ManPower Skills Management', href: '/admin/training-referral', icon: Send },
    ],
  },
  {
    label: 'Reports & Analytics',
    icon: FileBarChart,
    items: [
      { label: 'LMI Reports', href: '/admin/lmi', icon: FileBarChart },
      { label: 'Audit Trail', href: '/admin/audit', icon: ShieldCheck },
    ],
  },
  {
    label: 'Communications',
    icon: Megaphone,
    items: [
      { label: 'Announcements', href: '/admin/announcements', icon: Megaphone },
      { label: 'Notifications', href: '/admin/notifications', icon: Bell },
    ],
  },
  {
    label: 'System',
    icon: Settings,
    items: [{ label: 'Settings', href: '/admin/settings', icon: Settings }],
  },
]

export const ADMIN_NAV = flattenNavItems(ADMIN_NAV_GROUPS)

export const NAV_BY_ROLE = {
  jobseeker: JOBSEEKER_NAV,
  employer: EMPLOYER_NAV,
  staff: STAFF_NAV,
  admin: ADMIN_NAV,
}

/** Mixed shape (leaf | group) for the accordion sidebar. Consumed only by
 * Sidebar.jsx. Roles not yet converted reuse their existing flat array
 * (no entry has `.items`), so Sidebar renders them exactly as before. */
export const SIDEBAR_NAV_BY_ROLE = {
  jobseeker: JOBSEEKER_NAV_GROUPS,
  employer: EMPLOYER_NAV_GROUPS,
  staff: STAFF_NAV_GROUPS,
  admin: ADMIN_NAV_GROUPS,
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
