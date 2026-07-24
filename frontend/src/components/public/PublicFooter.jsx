import { Clock, Mail, MapPin, Phone } from 'lucide-react'
import { Link } from 'react-router-dom'

import logo from '../../assets/peso-logo.png'
import { SITE_INFO } from '../../config/siteInfo'

// lucide-react dropped brand icons — a minimal inline glyph avoids pulling in a
// whole new icon-set dependency just for one Facebook link.
function FacebookIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.5 1.49-3.89 3.77-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.88h2.78l-.45 2.91h-2.33V22c4.78-.76 8.44-4.92 8.44-9.94Z" />
    </svg>
  )
}

const QUICK_LINKS = [
  { label: 'Home', to: '/' },
  { label: 'Find Jobs', to: '/jobs' },
  { label: 'Job Fair', to: '/job-fair' },
  { label: 'Citizen Charter', to: '/citizen-charter' },
  { label: 'Services', to: '/services' },
  { label: 'About Us', to: '/about' },
  { label: 'Contact', to: '/contact' },
]

const RESOURCE_LINKS = [
  { label: 'How to Register', to: '/register/choose' },
  { label: 'Jobseeker Guide', to: '/jobseeker-guide' },
  { label: 'Employer Guide', to: '/employer-guide' },
  { label: 'Frequently Asked Questions', to: '/faqs' },
  { label: 'Privacy Policy', to: '/privacy-policy' },
  { label: 'Terms of Use', to: '/terms-of-use' },
]

function FooterLink({ item }) {
  if (item.onClick) {
    return (
      <button type="button" onClick={item.onClick} className="text-left text-sm text-primary-100/80 hover:text-white">
        {item.label}
      </button>
    )
  }
  return (
    <Link to={item.to} className="text-sm text-primary-100/80 hover:text-white">
      {item.label}
    </Link>
  )
}

export function PublicFooter() {
  return (
    <footer className="border-t border-primary-900/40 bg-primary-950 text-primary-100">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <img src={logo} alt="JobBridge" className="h-9 w-9" />
            <div>
              <p className="font-semibold text-white">JobBridge</p>
              <p className="text-xs text-primary-100/70">PESO Pila, Laguna</p>
            </div>
          </div>
          <p className="text-sm text-primary-100/70">
            Empowering the community through employment opportunities and excellent public service.
          </p>
          <div className="flex gap-3 pt-1">
            <a
              href={SITE_INFO.facebookUrl}
              target="_blank"
              rel="noreferrer"
              aria-label="Facebook"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
            >
              <FacebookIcon className="h-4 w-4" />
            </a>
            <a
              href={`mailto:${SITE_INFO.contactEmail}`}
              aria-label="Email"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
            >
              <Mail className="h-4 w-4" />
            </a>
          </div>
        </div>

        <div>
          <p className="mb-3 text-sm font-semibold text-white">Quick Links</p>
          <div className="flex flex-col gap-2">
            {QUICK_LINKS.map((item) => (
              <FooterLink key={item.label} item={item} />
            ))}
          </div>
        </div>

        <div>
          <p className="mb-3 text-sm font-semibold text-white">Resources</p>
          <div className="flex flex-col gap-2">
            {RESOURCE_LINKS.map((item) => (
              <FooterLink key={item.label} item={item} />
            ))}
          </div>
        </div>

        <div>
          <p className="mb-3 text-sm font-semibold text-white">Contact Us</p>
          <div className="flex flex-col gap-3 text-sm text-primary-100/80">
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{SITE_INFO.address}</span>
            </div>
            <div className="flex items-start gap-2">
              <Phone className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Telefax: {SITE_INFO.telefax} · Mobile: {SITE_INFO.mobile}</span>
            </div>
            <div className="flex items-start gap-2">
              <Mail className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{SITE_INFO.email}</span>
            </div>
            <div className="flex items-start gap-2">
              <Clock className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{SITE_INFO.officeHours}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-4 text-xs text-primary-100/60 sm:flex-row sm:px-6">
          <p>© {new Date().getFullYear()} JobBridge PESO Pila, Laguna. All Rights Reserved.</p>
          <p>Powered by PESO Pila, Laguna ❤️</p>
        </div>
      </div>
    </footer>
  )
}
