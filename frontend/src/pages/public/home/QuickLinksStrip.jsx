import { Briefcase, CalendarDays, FileText, Users } from 'lucide-react'
import { Link } from 'react-router-dom'

const LINKS = [
  {
    icon: Users,
    title: 'For Jobseekers',
    description: 'Create your profile, find job matches, and apply easily.',
    cta: 'Get Started →',
    to: '/register',
  },
  {
    icon: Briefcase,
    title: 'For Employers',
    description: 'Post job openings and find the best talents.',
    cta: 'Learn More →',
    to: '/register?type=employer',
  },
  {
    icon: CalendarDays,
    title: 'For Job Fair',
    description: 'Join our upcoming job fairs and connect with employers.',
    cta: 'View Schedule →',
    to: '/job-fair',
  },
  {
    icon: FileText,
    title: 'Citizen Charter',
    description: 'Learn about our services and commitment to you.',
    cta: 'View Charter →',
    to: '/citizen-charter',
  },
]

export function QuickLinksStrip() {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-4 sm:px-6">
      <div className="grid grid-cols-1 gap-4 rounded-2xl bg-surface-secondary p-5 sm:grid-cols-2 lg:grid-cols-4">
        {LINKS.map(({ icon: Icon, title, description, cta, to, onClick }) => (
          <div key={title} className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-text-primary">{title}</p>
              <p className="text-xs text-text-muted">{description}</p>
              {onClick ? (
                <button type="button" onClick={onClick} className="mt-1 text-xs font-medium text-primary-700 hover:underline dark:text-primary-400">
                  {cta}
                </button>
              ) : (
                <Link to={to} className="mt-1 inline-block text-xs font-medium text-primary-700 hover:underline dark:text-primary-400">
                  {cta}
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
