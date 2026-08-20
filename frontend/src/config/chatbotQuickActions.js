/** Role- and page-aware quick-action prompts for ChatbotWidget. Each action is a short
 * button label plus the canned question it sends through the existing chat pipeline —
 * this is a pure UI convenience layered on top of the untouched /api/assistant/chat
 * flow, not a new code path. `byHref` keys match the route paths already defined in
 * config/navigation.js's NAV_BY_ROLE, so a page without a specific mapping here falls
 * back to its role's `default` set. */

const PUBLIC_DEFAULT = [
  { label: 'Find Jobs', prompt: 'What jobs are currently available?' },
  { label: 'How to Register', prompt: 'How do I create a JobBridge account?' },
  { label: 'View Job Fairs', prompt: 'Are there any upcoming job fairs?' },
  { label: 'About PESO Pila', prompt: 'What is PESO Pila and what does JobBridge do?' },
]

const JOBSEEKER_DEFAULT = [
  { label: 'Find Jobs', prompt: 'What jobs match my profile right now?' },
  { label: 'Check Applications', prompt: "What's the status of my job applications?" },
  { label: 'View Job Fairs', prompt: 'Are there any upcoming job fairs I can join?' },
  { label: 'My Notifications', prompt: 'Do I have any unread notifications?' },
]

const EMPLOYER_DEFAULT = [
  { label: 'Manage Vacancies', prompt: 'How do I post or manage a vacancy?' },
  { label: 'Check Applicants', prompt: 'Show me an overview of my recent applicants.' },
  { label: 'View Job Fairs', prompt: 'Are there any upcoming job fairs I can join as an employer?' },
  { label: 'My Notifications', prompt: 'Do I have any unread notifications?' },
]

const STAFF_DEFAULT = [
  { label: 'Show Pending Approvals', prompt: 'What items are currently pending my approval?' },
  { label: 'Manage Vacancies', prompt: 'What vacancies need review right now?' },
  { label: 'View Job Fairs', prompt: 'What job fairs are coming up or need attention?' },
  { label: 'Check Announcements', prompt: 'What announcements have been posted recently?' },
]

const ADMIN_DEFAULT = [
  { label: 'Show Pending Approvals', prompt: 'What items are currently pending approval system-wide?' },
  { label: 'System Overview', prompt: 'Give me a summary of the current system stats.' },
  { label: 'Manage Staff', prompt: 'How do I add or manage a staff account?' },
  { label: 'View Audit Trail', prompt: 'What are the most recent audit trail entries?' },
]

const CHATBOT_QUICK_ACTIONS = {
  public: { default: PUBLIC_DEFAULT, byHref: {} },
  jobseeker: {
    default: JOBSEEKER_DEFAULT,
    byHref: {
      '/jobseeker/jobs': [
        { label: 'How Matching Works', prompt: 'How does the AI job match score work?' },
        { label: 'How to Apply', prompt: 'How do I apply to a job posting?' },
      ],
      '/jobseeker/applications': [
        { label: 'Check Applications', prompt: "What's the status of my job applications?" },
        { label: 'Withdraw an Application', prompt: 'How do I withdraw an application?' },
      ],
      '/jobseeker/interviews': [
        { label: 'Upcoming Interviews', prompt: 'Do I have any upcoming interviews?' },
        { label: 'Reschedule an Interview', prompt: 'How do I request to reschedule an interview?' },
      ],
      '/jobseeker/jobfair': [
        { label: 'View Job Fairs', prompt: 'Are there any upcoming job fairs?' },
        { label: 'How to Register', prompt: 'How do I register for a job fair?' },
      ],
      '/jobseeker/spes': [{ label: 'SPES Status', prompt: 'What is the status of my SPES application?' }],
      '/jobseeker/dilp': [{ label: 'DILP Status', prompt: 'What is the status of my DILP application?' }],
      '/jobseeker/owwa': [{ label: 'OWWA Status', prompt: 'What is the status of my OWWA application?' }],
      '/jobseeker/training-referral': [
        { label: 'Referral Status', prompt: 'What is the status of my Manpower Training Referral?' },
      ],
    },
  },
  employer: {
    default: EMPLOYER_DEFAULT,
    byHref: {
      '/employer/vacancies': [
        { label: 'Post a Vacancy', prompt: 'How do I post a new vacancy?' },
        { label: 'Why Pending?', prompt: 'Why is my vacancy still pending approval?' },
      ],
      '/employer/applicants': [
        { label: 'Review Applicants', prompt: 'How do I review and manage applicants?' },
        { label: 'How Matching Works', prompt: 'How does the AI applicant match score work?' },
      ],
      '/employer/referrals': [{ label: 'How Referrals Work', prompt: 'How do referral letters work for employers?' }],
      '/employer/interviews': [{ label: 'Schedule Interview', prompt: 'How do I schedule an interview with an applicant?' }],
      '/employer/company': [{ label: 'Accreditation Docs', prompt: 'What documents do I need for company accreditation?' }],
      '/employer/jobfair': [{ label: 'View Job Fairs', prompt: 'How do I request a booth at a job fair?' }],
    },
  },
  staff: {
    default: STAFF_DEFAULT,
    byHref: {
      '/staff/vacancies': [{ label: 'Pending Vacancies', prompt: 'What vacancies are pending approval right now?' }],
      '/staff/employers': [{ label: 'Pending Accreditations', prompt: 'What employer accreditations are pending review?' }],
      '/staff/spes': [{ label: 'Pending SPES', prompt: 'What SPES applications need review?' }],
      '/staff/dilp': [{ label: 'Pending DILP', prompt: 'What DILP applications need review?' }],
      '/staff/owwa': [{ label: 'Pending OWWA', prompt: 'What OWWA applications need review?' }],
      '/staff/jobfair': [{ label: 'Pending Booths', prompt: 'What job fair booth requests are pending?' }],
      '/staff/announcements': [{ label: 'Post Announcement', prompt: 'How do I create a new announcement?' }],
    },
  },
  admin: {
    default: ADMIN_DEFAULT,
    byHref: {
      '/admin/audit': [{ label: 'Recent Activity', prompt: 'Show me the most recent audit trail entries.' }],
      '/admin/staff': [{ label: 'Manage Staff', prompt: 'How do I add a new staff account?' }],
      '/admin/vacancies': [{ label: 'Pending Vacancies', prompt: 'What vacancies are pending approval right now?' }],
      '/admin/employers': [{ label: 'Pending Accreditations', prompt: 'What employer accreditations are pending review?' }],
    },
  },
}

export function getQuickActions(role, pageHref) {
  const bucket = CHATBOT_QUICK_ACTIONS[role] || CHATBOT_QUICK_ACTIONS.public
  return (pageHref && bucket.byHref[pageHref]) || bucket.default
}
